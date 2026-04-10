import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { TraceabilityTransformer } from '../../../filemaker/transformers/traceability.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toWorkflowEventType, toFmSource } from '../../constants/enum-maps';
import type { FmSourceType } from '../../../filemaker/transformers/types';

export interface WorkflowBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  batchIndex: number;
  offset: number;
  limit: number;
  batchId: string;
  dateFrom?: string;
  dateTo?: string;
}

const TRAZA_CONFIG: Record<string, { database: string; layout: string }> = {
  BIOPSIAS: { database: 'BIOPSIAS', layout: 'TRAZA' },
  BIOPSIASRESPALDO: { database: 'BIOPSIASRESPALDO', layout: 'TRAZA' },
};

@Injectable()
export class WorkflowEventsBatchHandler {
  private readonly logger = new Logger(WorkflowEventsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly traceabilityTransformer: TraceabilityTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: WorkflowBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource, offset, limit, batchId, dateFrom, dateTo } = data;
    const config = TRAZA_CONFIG[fmSource];
    if (!config) {
      this.logger.warn(`No traceability config for source ${fmSource}, skipping`);
      if (batchId) {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: { status: 'COMPLETED', completedAt: new Date(), processedCount: 0 },
        });
      }
      await this.prisma.labImportRun.update({
        where: { id: data.runId },
        data: { completedBatches: { increment: 1 } },
      });
      await this.orchestrator.advancePhase(data.runId);
      return;
    }

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      let response;
      if (dateFrom && dateTo) {
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        const rangeStr = `${this.fmDate(from)}...${this.fmDate(to)}`;
        response = await this.fmApi.findRecords(
          config.database,
          config.layout,
          [{ 'Trazabilidad::Fecha_Macroscopía': rangeStr }],
          { offset, limit, dateformats: 2 },
        );
      } else {
        response = await this.fmApi.getRecords(config.database, config.layout, {
          offset,
          limit,
          dateformats: 2,
        });
      }

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of response.records) {
        try {
          const result = this.traceabilityTransformer.extract(record);
          if (result.events.length === 0) continue;

          // Find the DiagnosticReport
          const dr = await this.prisma.labDiagnosticReport.findFirst({
            where: {
              tenantId,
              fmSource: toFmSource(fmSource),
              fmInformeNumber: result.fmInformeNumber,
            },
          });

          if (!dr) {
            this.logger.debug(`No DR for informe ${result.fmInformeNumber} in ${fmSource}`);
            continue;
          }

          // Replace workflow events for this DR (atomic delete + recreate)
          await this.prisma.$transaction([
            this.prisma.labExamWorkflowEvent.deleteMany({
              where: { tenantId, diagnosticReportId: dr.id },
            }),
            this.prisma.labExamWorkflowEvent.createMany({
              data: result.events.map((e) => ({
                tenantId,
                diagnosticReportId: dr.id,
                eventType: toWorkflowEventType(e.eventType),
                sequenceOrder: e.sequenceOrder,
                occurredAt: e.occurredAt,
                performedByNameSnapshot: e.performedByNameSnapshot,
                sourceField: e.sourceField,
              })),
            }),
          ]);

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`[${fmSource}] Record ${record.recordId} failed: ${msg}`);
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
      this.logger.error(`Workflow batch ${batchId} failed: ${msg}`);

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

  private fmDate(d: Date): string {
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
  }
}
