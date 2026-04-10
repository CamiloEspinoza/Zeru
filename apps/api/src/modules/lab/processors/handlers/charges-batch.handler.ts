import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { ExamChargeTransformer } from '../../../filemaker/transformers/exam-charge.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import {
  toLabPaymentMethod,
  toLabChargeStatus,
  toLabExamChargeSource,
  toFmSource,
} from '../../constants/enum-maps';
import type { ExamChargeSourceType } from '../../../filemaker/transformers/types';

export interface ChargesBatchJobData {
  runId: string;
  tenantId: string;
  chargeSource: ExamChargeSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  batchId: string;
}

@Injectable()
export class ChargesBatchHandler {
  private readonly logger = new Logger(ChargesBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly examChargeTransformer: ExamChargeTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: ChargesBatchJobData): Promise<void> {
    const { runId, tenantId, chargeSource, offset, limit, batchId } = data;
    const layout =
      chargeSource === 'BIOPSIAS_INGRESOS'
        ? this.examChargeTransformer.biopsyLayout
        : this.examChargeTransformer.papLayout;

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const response = await this.fmApi.getRecords(
        this.examChargeTransformer.database,
        layout,
        { offset, limit, dateformats: 2 },
      );

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of response.records) {
        try {
          const charge =
            chargeSource === 'BIOPSIAS_INGRESOS'
              ? this.examChargeTransformer.extractBiopsyCharge(record)
              : this.examChargeTransformer.extractPapCharge(record);

          // Resolve DiagnosticReport by informe number
          // For biopsy charges, the DR is in BIOPSIAS; for PAP charges, in PAPANICOLAOU
          const drFmSource =
            chargeSource === 'BIOPSIAS_INGRESOS' ? 'BIOPSIAS' : 'PAPANICOLAOU';
          let dr = await this.prisma.labDiagnosticReport.findFirst({
            where: {
              tenantId,
              fmSource: toFmSource(drFmSource),
              fmInformeNumber: charge.fkInformeNumber,
            },
          });

          if (!dr) {
            // Try backup source
            const backupSource =
              chargeSource === 'BIOPSIAS_INGRESOS'
                ? 'BIOPSIASRESPALDO'
                : 'PAPANICOLAOUHISTORICO';
            dr = await this.prisma.labDiagnosticReport.findFirst({
              where: {
                tenantId,
                fmSource: toFmSource(backupSource),
                fmInformeNumber: charge.fkInformeNumber,
              },
            });
          }

          if (!dr) {
            this.logger.debug(
              `No DR for charge informe ${charge.fkInformeNumber}`,
            );
            errorCount++;
            errors.push({
              recordId: record.recordId,
              error: `No DR for informe ${charge.fkInformeNumber}`,
            });
            continue;
          }

          const diagnosticReportId = dr.id;

          // Resolve LabOrigin
          const origin = await this.prisma.labOrigin.findFirst({
            where: { tenantId, code: charge.labOriginCodeSnapshot },
            select: { id: true, legalEntityId: true },
          });
          if (!origin) {
            this.logger.warn(
              `LabOrigin not found for code "${charge.labOriginCodeSnapshot}" (charge record ${record.recordId}), skipping`,
            );
            errorCount++;
            errors.push({
              recordId: record.recordId,
              error: `LabOrigin not found for code "${charge.labOriginCodeSnapshot}"`,
            });
            continue;
          }

          // Resolve Liquidation (if FK exists)
          let liquidationId: string | null = null;
          if (charge.fkLiquidacion) {
            const fmPkLiq = parseInt(charge.fkLiquidacion, 10);
            if (!isNaN(fmPkLiq) && fmPkLiq > 0) {
              const liq = await this.prisma.labLiquidation.findFirst({
                where: { tenantId, fmPk: fmPkLiq },
              });
              liquidationId = liq?.id ?? null;
            }
          }

          // Resolve DirectPaymentBatch (if FK exists)
          let directPaymentBatchId: string | null = null;
          if (charge.fkRendicion) {
            const fmPkDpb = parseInt(charge.fkRendicion, 10);
            if (!isNaN(fmPkDpb) && fmPkDpb > 0) {
              const dpb = await this.prisma.labDirectPaymentBatch.findFirst({
                where: { tenantId, fmPk: fmPkDpb },
              });
              directPaymentBatchId = dpb?.id ?? null;
            }
          }

          await this.prisma.labExamCharge.upsert({
            where: {
              tenantId_fmSource_fmRecordPk: {
                tenantId,
                fmSource: toLabExamChargeSource(charge.fmSource),
                fmRecordPk: charge.fmRecordPk,
              },
            },
            create: {
              tenantId,
              fmSource: toLabExamChargeSource(charge.fmSource),
              fmRecordPk: charge.fmRecordPk,
              diagnosticReportId,
              feeCodesText: charge.feeCodesText,
              feeCodes: charge.feeCodes,
              paymentMethod: toLabPaymentMethod(charge.paymentMethod),
              amount: new Decimal(charge.amount),
              status: toLabChargeStatus(charge.status),
              labOriginId: origin.id,
              labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
              legalEntityId: origin.legalEntityId ?? null,
              liquidationId,
              directPaymentBatchId,
              enteredAt: charge.enteredAt ?? new Date(0),
              enteredByNameSnapshot: charge.enteredByNameSnapshot,
              pointOfEntry: charge.pointOfEntry,
            },
            update: {
              diagnosticReportId,
              feeCodesText: charge.feeCodesText,
              feeCodes: charge.feeCodes,
              paymentMethod: toLabPaymentMethod(charge.paymentMethod),
              amount: new Decimal(charge.amount),
              status: toLabChargeStatus(charge.status),
              labOriginId: origin.id,
              labOriginCodeSnapshot: charge.labOriginCodeSnapshot,
              legalEntityId: origin.legalEntityId ?? null,
              liquidationId,
              directPaymentBatchId,
              enteredAt: charge.enteredAt ?? new Date(0),
              enteredByNameSnapshot: charge.enteredByNameSnapshot,
              pointOfEntry: charge.pointOfEntry,
            },
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
        }
      }

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          recordCount: response.records.length,
          processedCount,
          errorCount,
          errors: errors.length > 0 ? errors : undefined,
          completedAt: new Date(),
        },
      });

      await this.prisma.labImportRun.update({
        where: { id: runId },
        data: {
          completedBatches: { increment: 1 },
          processedRecords: { increment: processedCount },
          errorRecords: { increment: errorCount },
        },
      });

      await this.orchestrator.advancePhase(runId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Charges batch ${batchId} failed: ${msg}`);

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'FAILED',
          errors: [{ error: msg }],
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }
}
