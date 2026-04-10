import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../filemaker/transformers/exam-charge.transformer';
import { LiquidationTransformer } from '../../filemaker/transformers/liquidation.transformer';
import { BiopsyTransformer } from '../../filemaker/transformers/biopsy.transformer';
import { TraceabilityTransformer } from '../../filemaker/transformers/traceability.transformer';
import {
  fromLabPaymentMethod,
  fromLabChargeStatus,
  fromLiquidationStatus,
} from '../constants/enum-maps';

export interface FmLabSyncEvent {
  tenantId: string;
  entityType:
    | 'lab-exam-charge'
    | 'lab-liquidation'
    | 'lab-direct-payment-batch'
    | 'lab-diagnostic-report'
    | 'lab-workflow-event'
    | 'lab-signer';
  entityId: string;
  action:
    | 'create'
    | 'update'
    | 'cancel'
    | 'confirm'
    | 'invoice'
    | 'payment'
    | 'close'
    | 'macroscopy-update'
    | 'macroscopy-complete'
    | 'macro-signer';
  changedFields?: string[];
}

@Injectable()
export class FmLabSyncService {
  private readonly logger = new Logger(FmLabSyncService.name);
  private processing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly examChargeTransformer: ExamChargeTransformer,
    private readonly liquidationTransformer: LiquidationTransformer,
    private readonly biopsyTransformer: BiopsyTransformer,
    private readonly traceabilityTransformer: TraceabilityTransformer,
  ) {}

  @OnEvent('fm.lab.sync')
  async handleLabSyncEvent(event: FmLabSyncEvent) {
    this.logger.log(
      `Lab sync event: ${event.action} ${event.entityType}/${event.entityId}`,
    );

    // For creates, we don't have an FmSyncRecord yet -- the sync processor
    // will create the FM record and then create the FmSyncRecord.
    if (event.action === 'create') {
      await this.handleCreate(event);
      return;
    }

    // For updates, find the existing FmSyncRecord and mark it PENDING_TO_FM
    const existing = await this.prisma.fmSyncRecord.findFirst({
      where: {
        tenantId: event.tenantId,
        entityType: event.entityType,
        entityId: event.entityId,
      },
    });

    if (!existing) {
      this.logger.warn(
        `No FmSyncRecord for ${event.entityType}/${event.entityId}, ` +
        `action=${event.action} -- will create FM record`,
      );
      await this.handleCreate(event);
      return;
    }

    await this.prisma.fmSyncRecord.update({
      where: { id: existing.id },
      data: {
        syncStatus: 'PENDING_TO_FM',
        syncError: null,
      },
    });
  }

  private async handleCreate(event: FmLabSyncEvent) {
    try {
      const result = await this.createInFm(event);
      if (result) {
        // Create FmSyncRecord for the new FM record
        await this.prisma.fmSyncRecord.create({
          data: {
            tenantId: event.tenantId,
            entityType: event.entityType,
            entityId: event.entityId,
            fmDatabase: result.database,
            fmLayout: result.layout,
            fmRecordId: result.recordId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
          },
        });
        await this.logSync({
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
          fmRecordId: result.recordId,
          action: 'lab-sync:create',
          direction: 'zeru_to_fm',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to create FM record for ${event.entityType}/${event.entityId}: ${msg}`,
      );
      // Create an error FmSyncRecord so retry can pick it up
      await this.prisma.fmSyncRecord.create({
        data: {
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
          fmDatabase: this.resolveFmDatabase(),
          fmLayout: this.resolveFmLayout(event),
          fmRecordId: `pending-create-${event.entityId}`,
          syncStatus: 'ERROR',
          syncError: `[zeru-to-fm] ${msg}`,
          lastSyncAt: new Date(),
        },
      });
    }
  }

  private async createInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string } | null> {
    if (event.entityType === 'lab-exam-charge') {
      return this.createExamChargeInFm(event);
    }
    if (event.entityType === 'lab-liquidation') {
      return this.createLiquidationInFm(event);
    }
    if (event.entityType === 'lab-signer' && event.action === 'macro-signer') {
      return this.createMacroSignerInFm(event);
    }
    this.logger.warn(`No create handler for ${event.entityType}`);
    return null;
  }

  private async createExamChargeInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    const charge = await this.prisma.labExamCharge.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    // Determine layout based on source
    const isBiopsy = charge.fmSource === 'BIOPSIAS_INGRESOS';
    const layout = isBiopsy
      ? this.examChargeTransformer.biopsyLayout
      : this.examChargeTransformer.papLayout;

    // Resolve liquidation FK
    let fkLiquidacion: string | null = null;
    if (charge.liquidationId) {
      const liq = await this.prisma.labLiquidation.findUnique({
        where: { id: charge.liquidationId },
        select: { fmPk: true },
      });
      fkLiquidacion = liq?.fmPk ? String(liq.fmPk) : null;
    }

    // Resolve DPB FK
    let fkRendicion: string | null = null;
    if (charge.directPaymentBatchId) {
      const dpb = await this.prisma.labDirectPaymentBatch.findUnique({
        where: { id: charge.directPaymentBatchId },
        select: { fmPk: true },
      });
      fkRendicion = dpb?.fmPk ? String(dpb.fmPk) : null;
    }

    const toFmData = {
      fkInformeNumber: charge.fmRecordPk, // This is the DR's fmInformeNumber linked via DR
      paymentMethodName: fromLabPaymentMethod(charge.paymentMethod),
      amount: Number(charge.amount),
      feeCodesText: charge.feeCodesText,
      statusName: fromLabChargeStatus(charge.status),
      labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
      enteredAt: charge.enteredAt,
      enteredByNameSnapshot: charge.enteredByNameSnapshot,
      pointOfEntry: charge.pointOfEntry,
      fkLiquidacion,
      fkRendicion,
    };

    // Resolve DR informe number for the FK
    const dr = await this.prisma.labDiagnosticReport.findUnique({
      where: { id: charge.diagnosticReportId },
      select: { fmInformeNumber: true },
    });
    if (dr) {
      toFmData.fkInformeNumber = dr.fmInformeNumber;
    }

    const fieldData = isBiopsy
      ? this.examChargeTransformer.biopsyChargeToFm(toFmData)
      : this.examChargeTransformer.papChargeToFm(toFmData);

    const result = await this.fmApi.createRecord(
      this.examChargeTransformer.database,
      layout,
      fieldData,
    );

    return {
      database: this.examChargeTransformer.database,
      layout,
      recordId: result.recordId,
    };
  }

  private async createLiquidationInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    const liq = await this.prisma.labLiquidation.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    // Resolve labOriginCode from legalEntity
    let labOriginCode = '';
    const origin = await this.prisma.labOrigin.findFirst({
      where: { legalEntityId: liq.legalEntityId },
      select: { code: true },
    });
    if (origin) labOriginCode = origin.code;

    const fieldData = this.liquidationTransformer.toFm({
      labOriginCode,
      periodLabel: liq.periodLabel,
      statusName: fromLiquidationStatus(liq.status),
      totalAmount: Number(liq.totalAmount),
      biopsyAmount: Number(liq.biopsyAmount),
      papAmount: Number(liq.papAmount),
      cytologyAmount: Number(liq.cytologyAmount),
      immunoAmount: Number(liq.immunoAmount),
      biopsyCount: liq.biopsyCount,
      papCount: liq.papCount,
      cytologyCount: liq.cytologyCount,
      immunoCount: liq.immunoCount,
      previousDebt: Number(liq.previousDebt),
      creditBalance: Number(liq.creditBalance),
    });

    const result = await this.fmApi.createRecord(
      this.liquidationTransformer.database,
      this.liquidationTransformer.layout,
      fieldData,
    );

    return {
      database: this.liquidationTransformer.database,
      layout: this.liquidationTransformer.layout,
      recordId: result.recordId,
    };
  }

  private async createMacroSignerInFm(
    event: FmLabSyncEvent,
  ): Promise<{ database: string; layout: string; recordId: string }> {
    const signer = await this.prisma.labDiagnosticReportSigner.findUniqueOrThrow({
      where: { id: event.entityId },
    });

    const fieldData = this.biopsyTransformer.macroSignerToFm({
      pathologistCode: signer.codeSnapshot,
      pathologistName: signer.nameSnapshot,
      assistantCode: null,
      assistantName: null,
    });

    const result = await this.fmApi.createRecord(
      this.biopsyTransformer.database,
      this.biopsyTransformer.macroSignerLayout,
      fieldData,
    );

    return {
      database: this.biopsyTransformer.database,
      layout: this.biopsyTransformer.macroSignerLayout,
      recordId: result.recordId,
    };
  }

  @Cron('*/30 * * * * *')
  async processPendingLabSync() {
    if (this.processing) return;
    this.processing = true;
    try {
      await this.doPendingLabSync();
    } finally {
      this.processing = false;
    }
  }

  private async doPendingLabSync() {
    const labEntityTypes = [
      'lab-exam-charge',
      'lab-liquidation',
      'lab-direct-payment-batch',
      'lab-diagnostic-report',
      'lab-workflow-event',
      'lab-signer',
    ];

    const pending = await this.prisma.fmSyncRecord.findMany({
      where: {
        syncStatus: 'PENDING_TO_FM',
        entityType: { in: labEntityTypes },
      },
      take: 10,
    });

    if (pending.length === 0) return;
    this.logger.log(`Processing ${pending.length} PENDING_TO_FM lab records...`);

    for (const record of pending) {
      try {
        if (!record.fmRecordId || record.fmRecordId.startsWith('pending-')) {
          // Re-attempt create instead of marking SYNCED
          await this.retryCreate(record);
          continue;
        }

        // Read current FM record to check modId for conflict detection
        let currentFmRecord;
        try {
          currentFmRecord = await this.fmApi.getRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('error 101') || msg.includes('not found')) {
            // Record deleted in FM -- mark synced
            await this.prisma.fmSyncRecord.update({
              where: { id: record.id },
              data: {
                syncStatus: 'SYNCED',
                lastSyncAt: new Date(),
                syncError: 'FM record deleted',
              },
            });
            continue;
          }
          throw error;
        }

        // Conflict detection: compare modId
        if (record.fmModId && currentFmRecord.modId !== record.fmModId) {
          this.logger.warn(
            `modId conflict for ${record.entityType}/${record.entityId}: ` +
            `expected=${record.fmModId}, actual=${currentFmRecord.modId}. ` +
            `Zeru wins (last-write-wins).`,
          );
          await this.logSync({
            tenantId: record.tenantId,
            entityType: record.entityType,
            entityId: record.entityId,
            fmRecordId: record.fmRecordId,
            action: 'lab-sync:conflict-detected',
            direction: 'zeru_to_fm',
            details: {
              expectedModId: record.fmModId,
              actualModId: currentFmRecord.modId,
            },
          });
        }

        const fieldData = await this.buildUpdateFieldData(record);

        if (fieldData && Object.keys(fieldData).length > 0) {
          await this.fmApi.updateRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
            fieldData,
            record.fmModId ?? undefined,
          );
        }

        // Re-read the FM record to get new modId
        let newModId = currentFmRecord.modId;
        try {
          const updated = await this.fmApi.getRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
          );
          newModId = updated.modId;
        } catch {
          // Non-critical -- modId will be refreshed on next sync
        }

        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
            syncError: null,
            fmModId: newModId,
          },
        });

        await this.logSync({
          tenantId: record.tenantId,
          entityType: record.entityType,
          entityId: record.entityId,
          fmRecordId: record.fmRecordId,
          action: 'lab-sync:update',
          direction: 'zeru_to_fm',
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Lab sync failed for ${record.id}: ${msg}`);
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'ERROR',
            syncError: `[zeru-to-fm] ${msg}`,
            retryCount: { increment: 1 },
          },
        });
      }
    }
  }

  private async retryCreate(record: {
    id: string;
    tenantId: string;
    entityType: string;
    entityId: string;
    fmDatabase: string;
    fmLayout: string;
  }) {
    try {
      const event: FmLabSyncEvent = {
        tenantId: record.tenantId,
        entityType: record.entityType as FmLabSyncEvent['entityType'],
        entityId: record.entityId,
        action: 'create',
      };

      const result = await this.createInFm(event);
      if (result) {
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            fmRecordId: result.recordId,
            fmDatabase: result.database,
            fmLayout: result.layout,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
            syncError: null,
          },
        });
        await this.logSync({
          tenantId: record.tenantId,
          entityType: record.entityType,
          entityId: record.entityId,
          fmRecordId: result.recordId,
          action: 'lab-sync:retry-create',
          direction: 'zeru_to_fm',
        });
      } else {
        // No handler for this entity type — mark synced to avoid infinite retry
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
            syncError: 'No create handler for entity type',
          },
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Retry create failed for ${record.entityType}/${record.entityId}: ${msg}`,
      );
      await this.prisma.fmSyncRecord.update({
        where: { id: record.id },
        data: {
          syncStatus: 'ERROR',
          syncError: `[zeru-to-fm] retry-create: ${msg}`,
          retryCount: { increment: 1 },
        },
      });
    }
  }

  private async buildUpdateFieldData(
    record: {
      entityType: string;
      entityId: string;
      fmLayout: string;
    },
  ): Promise<Record<string, unknown> | null> {
    switch (record.entityType) {
      case 'lab-exam-charge':
        return this.buildExamChargeUpdate(record.entityId);
      case 'lab-liquidation':
        return this.buildLiquidationUpdate(record.entityId);
      case 'lab-diagnostic-report':
        return this.buildDiagnosticReportUpdate(record.entityId, record.fmLayout);
      case 'lab-workflow-event':
        return this.buildWorkflowEventUpdate(record.entityId);
      default:
        this.logger.warn(`No update builder for ${record.entityType}`);
        return null;
    }
  }

  private async buildExamChargeUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const charge = await this.prisma.labExamCharge.findUniqueOrThrow({
      where: { id: entityId },
    });

    const dr = await this.prisma.labDiagnosticReport.findUnique({
      where: { id: charge.diagnosticReportId },
      select: { fmInformeNumber: true },
    });

    let fkLiquidacion: string | null = null;
    if (charge.liquidationId) {
      const liq = await this.prisma.labLiquidation.findUnique({
        where: { id: charge.liquidationId },
        select: { fmPk: true },
      });
      fkLiquidacion = liq?.fmPk ? String(liq.fmPk) : null;
    }

    let fkRendicion: string | null = null;
    if (charge.directPaymentBatchId) {
      const dpb = await this.prisma.labDirectPaymentBatch.findUnique({
        where: { id: charge.directPaymentBatchId },
        select: { fmPk: true },
      });
      fkRendicion = dpb?.fmPk ? String(dpb.fmPk) : null;
    }

    const toFmData = {
      fkInformeNumber: dr?.fmInformeNumber ?? 0,
      paymentMethodName: fromLabPaymentMethod(charge.paymentMethod),
      amount: Number(charge.amount),
      feeCodesText: charge.feeCodesText,
      statusName: fromLabChargeStatus(charge.status),
      labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
      enteredAt: charge.enteredAt,
      enteredByNameSnapshot: charge.enteredByNameSnapshot,
      pointOfEntry: charge.pointOfEntry,
      fkLiquidacion,
      fkRendicion,
    };

    const isBiopsy = charge.fmSource === 'BIOPSIAS_INGRESOS';
    return isBiopsy
      ? this.examChargeTransformer.biopsyChargeToFm(toFmData)
      : this.examChargeTransformer.papChargeToFm(toFmData);
  }

  private async buildLiquidationUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const liq = await this.prisma.labLiquidation.findUniqueOrThrow({
      where: { id: entityId },
    });

    let labOriginCode = '';
    const origin = await this.prisma.labOrigin.findFirst({
      where: { legalEntityId: liq.legalEntityId },
      select: { code: true },
    });
    if (origin) labOriginCode = origin.code;

    return this.liquidationTransformer.toFm({
      labOriginCode,
      periodLabel: liq.periodLabel,
      statusName: fromLiquidationStatus(liq.status),
      totalAmount: Number(liq.totalAmount),
      biopsyAmount: Number(liq.biopsyAmount),
      papAmount: Number(liq.papAmount),
      cytologyAmount: Number(liq.cytologyAmount),
      immunoAmount: Number(liq.immunoAmount),
      biopsyCount: liq.biopsyCount,
      papCount: liq.papCount,
      cytologyCount: liq.cytologyCount,
      immunoCount: liq.immunoCount,
      previousDebt: Number(liq.previousDebt),
      creditBalance: Number(liq.creditBalance),
    });
  }

  private async buildDiagnosticReportUpdate(
    entityId: string,
    fmLayout: string,
  ): Promise<Record<string, unknown>> {
    const report = await this.prisma.labDiagnosticReport.findUniqueOrThrow({
      where: { id: entityId },
      select: { macroscopicDescription: true },
    });

    // Only macroscopy fields are writable in v1
    if (fmLayout.includes('TEXTO') || fmLayout.includes('MACRO')) {
      return this.biopsyTransformer.macroscopyToFm({
        macroscopicDescription: report.macroscopicDescription ?? '',
      });
    }

    return {};
  }

  private async buildWorkflowEventUpdate(
    entityId: string,
  ): Promise<Record<string, unknown>> {
    const event = await this.prisma.labExamWorkflowEvent.findUniqueOrThrow({
      where: { id: entityId },
    });

    if (event.eventType === 'MACROSCOPY') {
      return this.traceabilityTransformer.macroscopyEventToFm({
        performedByNameSnapshot: event.performedByNameSnapshot,
        occurredAt: event.occurredAt,
      });
    }

    return {};
  }

  private resolveFmDatabase(): string {
    // All lab entities come from BIOPSIAS database
    return 'BIOPSIAS';
  }

  private resolveFmLayout(event: FmLabSyncEvent): string {
    switch (event.entityType) {
      case 'lab-exam-charge':
        return this.examChargeTransformer.biopsyLayout;
      case 'lab-liquidation':
        return this.liquidationTransformer.layout;
      case 'lab-diagnostic-report':
        return this.biopsyTransformer.macroscopyLayout;
      case 'lab-workflow-event':
        return this.traceabilityTransformer.layout;
      case 'lab-signer':
        return this.biopsyTransformer.macroSignerLayout;
      default:
        return 'unknown';
    }
  }

  private async logSync(data: {
    tenantId: string;
    entityType: string;
    entityId: string;
    fmRecordId?: string;
    action: string;
    direction: string;
    details?: unknown;
  }) {
    return this.prisma.fmSyncLog.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fmRecordId: data.fmRecordId,
        action: data.action,
        direction: data.direction,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        details: data.details as any,
      },
    });
  }
}
