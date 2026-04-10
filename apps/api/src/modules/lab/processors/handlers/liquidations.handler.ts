import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { LiquidationTransformer } from '../../../filemaker/transformers/liquidation.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toLiquidationStatus } from '../../constants/enum-maps';

export interface LiquidationsJobData {
  runId: string;
  tenantId: string;
  batchId: string;
}

@Injectable()
export class LiquidationsHandler {
  private readonly logger = new Logger(LiquidationsHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly liquidationTransformer: LiquidationTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: LiquidationsJobData): Promise<void> {
    const { runId, tenantId, batchId } = data;

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const records = await this.fmApi.getAllRecords(
        this.liquidationTransformer.database,
        this.liquidationTransformer.layout,
        { dateformats: 2 },
      );

      this.logger.log(`Fetched ${records.length} liquidation records`);

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of records) {
        try {
          const liq = this.liquidationTransformer.extract(record);

          // Resolve LabOrigin → LegalEntity
          const origin = await this.prisma.labOrigin.findFirst({
            where: { tenantId, code: liq.labOriginCode },
            select: { id: true, legalEntityId: true, billingAgreementId: true },
          });

          const legalEntityId = origin?.legalEntityId ?? null;
          if (!legalEntityId) {
            this.logger.warn(
              `No LegalEntity for origin code ${liq.labOriginCode}, skipping liquidation ${liq.fmPk}`,
            );
            errorCount++;
            errors.push({
              recordId: record.recordId,
              error: `No LegalEntity for origin ${liq.labOriginCode}`,
            });
            continue;
          }

          await this.prisma.labLiquidation.upsert({
            where: {
              tenantId_fmRecordId: {
                tenantId,
                fmRecordId: record.recordId,
              },
            },
            create: {
              tenantId,
              fmRecordId: record.recordId,
              fmPk: liq.fmPk,
              legalEntityId,
              billingAgreementId: origin?.billingAgreementId ?? null,
              period: liq.period ?? new Date(0),
              periodLabel: liq.periodLabel,
              totalAmount: liq.totalAmount,
              biopsyAmount: liq.biopsyAmount,
              papAmount: liq.papAmount,
              cytologyAmount: liq.cytologyAmount,
              immunoAmount: liq.immunoAmount,
              biopsyCount: liq.biopsyCount,
              papCount: liq.papCount,
              cytologyCount: liq.cytologyCount,
              immunoCount: liq.immunoCount,
              previousDebt: liq.previousDebt,
              creditBalance: liq.creditBalance,
              status: toLiquidationStatus(liq.status),
              confirmedAt: liq.confirmedAt,
              confirmedByNameSnapshot: liq.confirmedByNameSnapshot,
              invoiceNumber: liq.invoiceNumber,
              invoiceDate: liq.invoiceDate,
              paymentAmount: liq.paymentAmount,
              paymentDate: liq.paymentDate,
              paymentMethodText: liq.paymentMethodText,
              notes: liq.notes,
            },
            update: {
              fmPk: liq.fmPk,
              legalEntityId,
              billingAgreementId: origin?.billingAgreementId ?? null,
              period: liq.period ?? new Date(0),
              periodLabel: liq.periodLabel,
              totalAmount: liq.totalAmount,
              biopsyAmount: liq.biopsyAmount,
              papAmount: liq.papAmount,
              cytologyAmount: liq.cytologyAmount,
              immunoAmount: liq.immunoAmount,
              biopsyCount: liq.biopsyCount,
              papCount: liq.papCount,
              cytologyCount: liq.cytologyCount,
              immunoCount: liq.immunoCount,
              previousDebt: liq.previousDebt,
              creditBalance: liq.creditBalance,
              status: toLiquidationStatus(liq.status),
              confirmedAt: liq.confirmedAt,
              confirmedByNameSnapshot: liq.confirmedByNameSnapshot,
              invoiceNumber: liq.invoiceNumber,
              invoiceDate: liq.invoiceDate,
              paymentAmount: liq.paymentAmount,
              paymentDate: liq.paymentDate,
              paymentMethodText: liq.paymentMethodText,
              notes: liq.notes,
            },
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`Liquidation record ${record.recordId} failed: ${msg}`);
        }
      }

      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: {
          status: 'COMPLETED',
          recordCount: records.length,
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
      this.logger.error(`Liquidations batch failed: ${msg}`);

      try {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: {
            status: 'PENDING', // Keep PENDING so advancePhase counts it during retries
            errors: [{ error: msg }],
          },
        });
      } catch (e) {
        this.logger.error(`Failed to update batch status: ${e}`);
      }

      throw error;
    }
  }
}
