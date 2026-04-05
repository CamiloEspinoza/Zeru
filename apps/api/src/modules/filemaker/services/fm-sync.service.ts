import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { FmApiService } from './fm-api.service';
import { ProcedenciasTransformer } from '../transformers/procedencias.transformer';
import { normalizeRut } from '@zeru/shared';
import type { FmSyncStats } from '@zeru/shared';

interface FmSyncEvent {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
}

@Injectable()
export class FmSyncService {
  private readonly logger = new Logger(FmSyncService.name);
  private processingToFm = false;
  private processingToZeru = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly transformer: ProcedenciasTransformer,
  ) {}

  async getStats(tenantId: string): Promise<FmSyncStats> {
    const counts = await this.prisma.fmSyncRecord.groupBy({
      by: ['syncStatus'],
      where: { tenantId },
      _count: true,
    });

    const stats: FmSyncStats = { synced: 0, pendingToFm: 0, pendingToZeru: 0, error: 0, total: 0 };
    for (const row of counts) {
      const count = row._count;
      switch (row.syncStatus) {
        case 'SYNCED': stats.synced = count; break;
        case 'PENDING_TO_FM': stats.pendingToFm = count; break;
        case 'PENDING_TO_ZERU': stats.pendingToZeru = count; break;
        case 'ERROR': stats.error = count; break;
      }
      stats.total += count;
    }
    return stats;
  }

  async getErrors(tenantId: string, limit = 20) {
    return this.prisma.fmSyncRecord.findMany({
      where: { tenantId, syncStatus: 'ERROR' },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async getRecentLogs(tenantId: string, limit = 50) {
    return this.prisma.fmSyncLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  @OnEvent('fm.sync')
  async handleSyncEvent(event: FmSyncEvent) {
    this.logger.log(`FM sync event: ${event.action} ${event.entityType}/${event.entityId}`);

    const existing = await this.prisma.fmSyncRecord.findUnique({
      where: {
        tenantId_entityType_entityId: {
          tenantId: event.tenantId,
          entityType: event.entityType,
          entityId: event.entityId,
        },
      },
    });

    if (!existing) {
      this.logger.warn(`No FmSyncRecord found for ${event.entityType}/${event.entityId}, skipping`);
      return;
    }

    await this.prisma.fmSyncRecord.update({
      where: { id: existing.id },
      data: { syncStatus: 'PENDING_TO_FM' },
    });
  }

  @Cron('*/5 * * * *')
  async retryErrors() {
    const maxRetries = 5;
    const errors = await this.prisma.fmSyncRecord.findMany({
      where: { syncStatus: 'ERROR', retryCount: { lt: maxRetries } },
      take: 20,
    });

    if (errors.length === 0) return;

    this.logger.log(`Retrying ${errors.length} failed sync records...`);

    for (const record of errors) {
      try {
        // Determine retry direction from the error context:
        // If syncError mentions 'zeru-to-fm' or entity was locally changed, retry as PENDING_TO_FM
        // Otherwise default to PENDING_TO_ZERU (FM is source of truth)
        const retryStatus = record.syncError?.includes('zeru-to-fm')
          ? 'PENDING_TO_FM' as const
          : 'PENDING_TO_ZERU' as const;
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: retryStatus },
        });
      } catch (error) {
        this.logger.error(`Retry failed for ${record.id}: ${error}`);
      }
    }
  }

  @Cron('*/30 * * * * *')
  async processPendingToFm() {
    if (this.processingToFm) return;
    this.processingToFm = true;
    try {
      await this.doPendingToFm();
    } finally {
      this.processingToFm = false;
    }
  }

  private async doPendingToFm() {
    const pending = await this.prisma.fmSyncRecord.findMany({
      where: { syncStatus: 'PENDING_TO_FM' },
      take: 10,
    });

    if (pending.length === 0) return;
    this.logger.log(`Processing ${pending.length} PENDING_TO_FM records...`);

    for (const record of pending) {
      try {
        if (!record.fmRecordId || record.fmRecordId.startsWith('pending-')) {
          // No FM record to update (entity was created in Zeru only)
          await this.prisma.fmSyncRecord.update({
            where: { id: record.id },
            data: { syncStatus: 'SYNCED', lastSyncAt: new Date() },
          });
          continue;
        }

        let fmFieldData: Record<string, unknown> | null = null;

        if (record.entityType === 'lab-origin') {
          const origin = await this.prisma.labOrigin.findUnique({
            where: { id: record.entityId },
          });
          if (!origin) {
            // Entity was deleted in Zeru — don't propagate delete to FM, just mark synced
            await this.prisma.fmSyncRecord.update({
              where: { id: record.id },
              data: { syncStatus: 'SYNCED', lastSyncAt: new Date(), syncError: 'Entity deleted in Zeru' },
            });
            continue;
          }
          fmFieldData = this.transformer.labOriginToFm(origin);
        } else if (record.entityType === 'legal-entity') {
          const entity = await this.prisma.legalEntity.findUnique({
            where: { id: record.entityId },
          });
          if (!entity) {
            await this.prisma.fmSyncRecord.update({
              where: { id: record.id },
              data: { syncStatus: 'SYNCED', lastSyncAt: new Date(), syncError: 'Entity deleted in Zeru' },
            });
            continue;
          }
          fmFieldData = this.transformer.legalEntityToFm(entity);
        }

        if (fmFieldData) {
          await this.fmApi.updateRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
            fmFieldData,
          );
        }

        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'SYNCED', lastSyncAt: new Date(), syncError: null },
        });

        await this.logSync({
          tenantId: record.tenantId,
          entityType: record.entityType,
          entityId: record.entityId,
          fmRecordId: record.fmRecordId,
          action: 'sync:zeru-to-fm',
          direction: 'zeru_to_fm',
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to sync record ${record.id} to FM: ${msg}`);
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'ERROR', syncError: `[zeru-to-fm] ${msg}`, retryCount: { increment: 1 } },
        });
      }
    }
  }

  @Cron('*/30 * * * * *')
  async processPendingToZeru() {
    if (this.processingToZeru) return;
    this.processingToZeru = true;
    try {
      await this.doPendingToZeru();
    } finally {
      this.processingToZeru = false;
    }
  }

  private async doPendingToZeru() {
    const pending = await this.prisma.fmSyncRecord.findMany({
      where: { syncStatus: 'PENDING_TO_ZERU' },
      take: 10,
    });

    if (pending.length === 0) return;
    this.logger.log(`Processing ${pending.length} PENDING_TO_ZERU records...`);

    for (const record of pending) {
      try {
        // Handle unknown records (new records from webhook that need full import)
        if (record.entityType === 'unknown') {
          await this.processUnknownRecord(record);
          continue;
        }

        // Read full FM record (getRecord throws on 404/missing)
        let fmRecord;
        try {
          fmRecord = await this.fmApi.getRecord(
            record.fmDatabase,
            record.fmLayout,
            record.fmRecordId,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes('401') || msg.includes('not found') || msg.includes('error 101')) {
            await this.handleFmRecordDeleted(record);
            continue;
          }
          throw error;
        }

        if (!fmRecord) {
          await this.handleFmRecordDeleted(record);
          continue;
        }

        // Process based on entity type
        if (record.entityType === 'lab-origin' && record.entityId) {
          const originData = this.transformer.extractLabOrigin(fmRecord);
          await this.prisma.labOrigin.update({
            where: { id: record.entityId },
            data: originData,
          });
        } else if (record.entityType === 'legal-entity' && record.entityId) {
          const leData = this.transformer.extractLegalEntity(fmRecord);
          if (leData) {
            await this.prisma.legalEntity.update({
              where: { id: record.entityId },
              data: leData,
            });
          }
        }
        // Mark as synced
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'SYNCED', lastSyncAt: new Date(), syncError: null },
        });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process sync record ${record.id}: ${msg}`);
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'ERROR', syncError: msg, retryCount: { increment: 1 } },
        });
      }
    }
  }

  private async processUnknownRecord(record: {
    id: string;
    tenantId: string;
    fmDatabase: string;
    fmLayout: string;
    fmRecordId: string;
  }) {
    if (record.fmLayout !== this.transformer.layout) {
      await this.prisma.fmSyncRecord.update({
        where: { id: record.id },
        data: { syncStatus: 'ERROR', syncError: `No transformer for layout: ${record.fmLayout}` },
      });
      return;
    }

    try {
      let fmRecord;
      try {
        fmRecord = await this.fmApi.getRecord(
          record.fmDatabase,
          record.fmLayout,
          record.fmRecordId,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('401') || msg.includes('not found') || msg.includes('error 101')) {
          // FM record was deleted — clean up the unknown sync record
          await this.prisma.fmSyncRecord.delete({ where: { id: record.id } }).catch(() => {});
          return;
        }
        throw error;
      }

      if (!fmRecord) {
        await this.prisma.fmSyncRecord.delete({ where: { id: record.id } }).catch(() => {});
        return;
      }

      // Extract and create/update LegalEntity
      const leData = this.transformer.extractLegalEntity(fmRecord);
      let legalEntityId: string | null = null;
      if (leData) {
        const existingLe = await this.prisma.legalEntity.findFirst({
          where: { tenantId: record.tenantId, rut: leData.rut },
        });
        if (existingLe) {
          legalEntityId = existingLe.id;
          await this.prisma.legalEntity.update({
            where: { id: existingLe.id },
            data: leData,
          });
        } else {
          const le = await this.prisma.legalEntity.create({
            data: { ...leData, tenantId: record.tenantId },
          });
          legalEntityId = le.id;
          // Create LE sync record
          await this.prisma.fmSyncRecord.create({
            data: {
              tenantId: record.tenantId,
              entityType: 'legal-entity',
              entityId: le.id,
              fmDatabase: record.fmDatabase,
              fmLayout: record.fmLayout,
              fmRecordId: record.fmRecordId,
              syncStatus: 'SYNCED',
              lastSyncAt: new Date(),
            },
          }).catch(() => {}); // Ignore if already exists
        }
      }

      // Extract and create/update LabOrigin
      const originData = this.transformer.extractLabOrigin(fmRecord);
      const existingOrigin = await this.prisma.labOrigin.findFirst({
        where: { tenantId: record.tenantId, code: originData.code },
      });
      let originId: string;
      if (existingOrigin) {
        await this.prisma.labOrigin.update({
          where: { id: existingOrigin.id },
          data: { ...originData, legalEntityId },
        });
        originId = existingOrigin.id;
      } else {
        const origin = await this.prisma.labOrigin.create({
          data: { ...originData, legalEntityId, tenantId: record.tenantId },
        });
        originId = origin.id;
      }

      // Check if a sync record already exists for this FM record + lab-origin (e.g., from concurrent import)
      const existingSync = await this.prisma.fmSyncRecord.findFirst({
        where: {
          tenantId: record.tenantId,
          fmDatabase: record.fmDatabase,
          fmLayout: record.fmLayout,
          fmRecordId: record.fmRecordId,
          entityType: 'lab-origin',
        },
      });

      if (existingSync) {
        // Import already created the sync record — delete the unknown one
        await this.prisma.fmSyncRecord.delete({ where: { id: record.id } }).catch(() => {});
      } else {
        // Convert the unknown sync record to lab-origin
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: {
            entityType: 'lab-origin',
            entityId: originId,
            syncStatus: 'SYNCED',
            lastSyncAt: new Date(),
            syncError: null,
          },
        });
      }

      await this.logSync({
        tenantId: record.tenantId,
        entityType: 'lab-origin',
        entityId: originId,
        fmRecordId: record.fmRecordId,
        action: 'webhook:create-processed',
        direction: 'fm_to_zeru',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process unknown record ${record.id}: ${msg}`);
      await this.prisma.fmSyncRecord.update({
        where: { id: record.id },
        data: { syncStatus: 'ERROR', syncError: msg, retryCount: { increment: 1 } },
      });
    }
  }

  private async handleFmRecordDeleted(record: { id: string; entityType: string; entityId: string }) {
    // Soft-delete (not hard delete) — consistent with the rest of the system
    if (record.entityType === 'lab-origin' && record.entityId) {
      await this.prisma.labOrigin.update({
        where: { id: record.entityId },
        data: { deletedAt: new Date(), isActive: false },
      }).catch(() => {});
    } else if (record.entityType === 'legal-entity' && record.entityId) {
      await this.prisma.legalEntity.update({
        where: { id: record.entityId },
        data: { deletedAt: new Date(), isActive: false },
      }).catch(() => {});
    }
    await this.prisma.fmSyncRecord.update({
      where: { id: record.id },
      data: { syncStatus: 'SYNCED', lastSyncAt: new Date(), syncError: 'FM record deleted' },
    });
  }

  private static readonly INSTITUTION_LAYOUT = 'FICHA INSTITUCION COBRANZAS';

  private async processInstitutionWebhook(tenantId: string, fmRecordId: string) {
    this.logger.log(`Processing institution webhook for FM record ${fmRecordId}`);

    let fmRecord;
    try {
      fmRecord = await this.fmApi.getRecord(
        this.transformer.database,
        FmSyncService.INSTITUTION_LAYOUT,
        fmRecordId,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to read institution record ${fmRecordId}: ${msg}`);
      return;
    }

    if (!fmRecord) return;

    const d = fmRecord.fieldData;
    const rawRut = String(d['Rut'] ?? '').trim();
    if (!rawRut) {
      this.logger.warn(`Institution record ${fmRecordId} has no RUT, skipping`);
      return;
    }

    const rut = normalizeRut(rawRut);
    if (rut.length < 3) return;

    // Find LegalEntity by RUT
    const le = await this.prisma.legalEntity.findFirst({
      where: { tenantId, rut },
    });

    if (!le) {
      this.logger.warn(`No LegalEntity found for RUT ${rut} from institution webhook`);
      return;
    }

    // Build update data from institution fields (non-null only)
    const parsePaymentTerms = (val: string) => {
      const n = Number(val?.replace(/[^0-9]/g, ''));
      if (isNaN(n) || !val) return undefined;
      if (n <= 0) return 'IMMEDIATE' as const;
      if (n <= 15) return 'NET_15' as const;
      if (n <= 30) return 'NET_30' as const;
      if (n <= 45) return 'NET_45' as const;
      if (n <= 60) return 'NET_60' as const;
      if (n <= 90) return 'NET_90' as const;
      return 'CUSTOM' as const;
    };

    const parseBillingDay = (val: string): number | undefined => {
      if (!val) return undefined;
      const n = Number(val.replace(/[^0-9]/g, ''));
      if (!n || isNaN(n) || n < 1 || n > 28) return undefined;
      return n;
    };

    const legalName = String(d['Razón Social'] ?? '').trim() || undefined;
    const email = String(d['Contacto Facturación EMAIL'] ?? '').trim() || undefined;
    const paymentTerms = parsePaymentTerms(String(d['PlazoPago'] ?? '').trim());
    const billingDayOfMonth = parseBillingDay(String(d['Día de Facturación'] ?? '').trim());

    const updateData = Object.fromEntries(
      Object.entries({ legalName, email, paymentTerms, billingDayOfMonth })
        .filter(([, v]) => v !== undefined),
    );

    if (Object.keys(updateData).length > 0) {
      await this.prisma.legalEntity.update({
        where: { id: le.id },
        data: updateData,
      });
      this.logger.log(`Updated LegalEntity ${le.id} (RUT ${rut}) from institution webhook`);
    }

    // Also update contacts from the institution's CONTACTOS Cobranzas portal
    const portalData = fmRecord.portalData?.['CONTACTOS Cobranzas'];
    if (portalData && Array.isArray(portalData) && portalData.length > 0) {
      await this.prisma.legalEntityContact.deleteMany({
        where: { legalEntityId: le.id, tenantId },
      });
      for (const row of portalData) {
        const firstName = String(row['CONTACTOS Cobranzas::Nombre'] ?? '').trim();
        const lastName = String(row['CONTACTOS Cobranzas::Apellido'] ?? '').trim();
        const name = [firstName, lastName].filter(Boolean).join(' ');
        if (!name) continue;
        await this.prisma.legalEntityContact.create({
          data: {
            name,
            role: String(row['CONTACTOS Cobranzas::Cargo'] ?? '').trim() || null,
            email: String(row['CONTACTOS Cobranzas::Email'] ?? '').trim() || null,
            phone: String(row['CONTACTOS Cobranzas::Tel Fijo'] ?? '').trim() || null,
            mobile: String(row['CONTACTOS Cobranzas::Tel Celular'] ?? '').trim() || null,
            legalEntityId: le.id,
            tenantId,
          },
        });
      }
      this.logger.log(`Replaced contacts for LegalEntity ${le.id} from institution webhook`);
    }

    await this.logSync({
      tenantId,
      entityType: 'legal-entity',
      entityId: le.id,
      fmRecordId,
      action: 'webhook:institution-update',
      direction: 'fm_to_zeru',
    });
  }

  async handleWebhook(tenantId: string, data: {
    database: string;
    layout: string;
    recordId: string;
    action: 'create' | 'update' | 'delete';
  }) {
    this.logger.log(`FM webhook: ${data.action} ${data.database}/${data.layout}/${data.recordId}`);

    // Institution layout: directly update LegalEntity by RUT (no sync records needed)
    if (data.layout === FmSyncService.INSTITUTION_LAYOUT) {
      if (data.action === 'delete') {
        this.logger.log(`Ignoring delete webhook for institution record ${data.recordId}`);
      } else {
        await this.processInstitutionWebhook(tenantId, data.recordId);
      }
      await this.logSync({
        tenantId,
        entityType: 'legal-entity',
        fmRecordId: data.recordId,
        action: `webhook:institution:${data.action}`,
        direction: 'fm_to_zeru',
      });
      return;
    }

    // Find all sync records for this FM record (may be multiple for composite transformers)
    const existing = await this.prisma.fmSyncRecord.findMany({
      where: {
        tenantId,
        fmDatabase: data.database,
        fmLayout: data.layout,
        fmRecordId: data.recordId,
      },
    });

    if (existing.length > 0) {
      // Mark all as pending to sync from FM to Zeru
      for (const record of existing) {
        await this.prisma.fmSyncRecord.update({
          where: { id: record.id },
          data: { syncStatus: 'PENDING_TO_ZERU' },
        });
      }
    } else if (data.action === 'delete') {
      // Delete for a record we never imported — nothing to do
      this.logger.log(`Ignoring delete webhook for untracked FM record ${data.recordId}`);
    } else {
      // New record in FM — create a sync record for future processing
      try {
        await this.prisma.fmSyncRecord.create({
          data: {
            tenantId,
            entityType: 'unknown',
            entityId: `pending-${randomUUID()}`,
            fmDatabase: data.database,
            fmLayout: data.layout,
            fmRecordId: data.recordId,
            syncStatus: 'PENDING_TO_ZERU',
            lastSyncAt: new Date(),
          },
        });
      } catch {
        // Concurrent webhook — record already exists, just ensure it's pending
        await this.prisma.fmSyncRecord.updateMany({
          where: {
            tenantId,
            fmDatabase: data.database,
            fmLayout: data.layout,
            fmRecordId: data.recordId,
          },
          data: { syncStatus: 'PENDING_TO_ZERU' },
        });
      }
    }

    await this.logSync({
      tenantId,
      entityType: existing[0]?.entityType ?? 'unknown',
      fmRecordId: data.recordId,
      action: `webhook:${data.action}`,
      direction: 'fm_to_zeru',
      details: { ...data, syncRecordCount: existing.length },
    });
  }

  async logSync(data: {
    tenantId: string;
    entityType: string;
    entityId?: string;
    fmRecordId?: string;
    action: string;
    direction: string;
    details?: unknown;
    error?: string;
    duration?: number;
  }) {
    return this.prisma.fmSyncLog.create({
      data: {
        tenantId: data.tenantId,
        entityType: data.entityType,
        entityId: data.entityId,
        fmRecordId: data.fmRecordId,
        action: data.action,
        direction: data.direction,
        details: data.details as any,
        error: data.error,
        duration: data.duration,
      },
    });
  }
}
