import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { PractitionersTransformer } from '../../../filemaker/transformers/practitioners.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';

export interface PractitionersImportJobData {
  runId: string;
  tenantId: string;
  batchId: string;
}

@Injectable()
export class PractitionersHandler {
  private readonly logger = new Logger(PractitionersHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly transformer: PractitionersTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: PractitionersImportJobData): Promise<void> {
    const { runId, tenantId, batchId } = data;

    try {
      await this.prisma.labImportBatch.update({
        where: { id: batchId },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const records = await this.fmApi.getAllRecords(
        this.transformer.database,
        this.transformer.layout,
      );
      this.logger.log(`Fetched ${records.length} PATOLOGOS INFORMANTES records`);

      let processedCount = 0;
      let errorCount = 0;
      const errors: Array<{ recordId: string; error: string }> = [];

      for (const record of records) {
        try {
          const p = this.transformer.extract(record);
          if (!p.code) {
            errorCount++;
            errors.push({ recordId: record.recordId, error: 'empty Codigo' });
            continue;
          }

          await this.prisma.labPractitioner.upsert({
            where: { tenantId_code: { tenantId, code: p.code } },
            create: {
              tenantId,
              code: p.code,
              codeSnapshot: p.code,
              firstName: p.firstName,
              paternalLastName: p.paternalLastName,
              maternalLastName: p.maternalLastName,
              roles: ['PATHOLOGIST'],
              isInternal: true,
              specialty: p.specialty,
              isActive: p.isActive,
            },
            update: {
              codeSnapshot: p.code,
              firstName: p.firstName,
              paternalLastName: p.paternalLastName,
              maternalLastName: p.maternalLastName,
              specialty: p.specialty,
              isActive: p.isActive,
            },
          });

          processedCount++;
        } catch (error) {
          errorCount++;
          const msg = error instanceof Error ? error.message : String(error);
          errors.push({ recordId: record.recordId, error: msg });
          this.logger.warn(`Practitioner record ${record.recordId} failed: ${msg}`);
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
      this.logger.error(`Practitioners batch failed: ${msg}`);

      try {
        await this.prisma.labImportBatch.update({
          where: { id: batchId },
          data: {
            status: 'PENDING',
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
