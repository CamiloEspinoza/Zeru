import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { FmApiService } from '../../../filemaker/services/fm-api.service';
import { CommunicationTransformer } from '../../../filemaker/transformers/communication.transformer';
import { LabImportOrchestratorService } from '../../services/lab-import-orchestrator.service';
import { toCommunicationCategory, toFmSource } from '../../constants/enum-maps';
import type { FmSourceType, ExtractedCommunication } from '../../../filemaker/transformers/types';

export interface CommsBatchJobData {
  runId: string;
  tenantId: string;
  fmSource: FmSourceType;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class CommunicationsBatchHandler {
  private readonly logger = new Logger(CommunicationsBatchHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fmApi: FmApiService,
    private readonly communicationTransformer: CommunicationTransformer,
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  async handle(data: CommsBatchJobData): Promise<void> {
    const { runId, tenantId, fmSource } = data;

    const batch = await this.prisma.labImportBatch.findFirst({
      where: { runId, phase: 'phase-2-workflow-comms', fmSource },
      orderBy: { createdAt: 'desc' },
    });

    try {
      if (batch) {
        await this.prisma.labImportBatch.update({
          where: { id: batch.id },
          data: { status: 'RUNNING', startedAt: new Date() },
        });
      }

      let processedCount = 0;
      let errorCount = 0;

      // PAP: standalone COMUNICACIONES table
      if (fmSource === 'PAPANICOLAOU') {
        const records = await this.fmApi.getAllRecords(
          this.communicationTransformer.papDatabase,
          this.communicationTransformer.papLayout,
          { dateformats: 2 },
        );

        for (const record of records) {
          try {
            const comm = this.communicationTransformer.extractFromPapRecord(record);
            if (!comm) continue;

            await this.persistCommunication(tenantId, fmSource, comm);
            processedCount++;
          } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`PAP comm record ${record.recordId} failed: ${msg}`);
          }
        }
      }

      // BIOPSIAS: communications are in the exam portal, already extracted during Phase 1
      // We re-fetch only the exam records that have communications (portal data)
      // This is handled separately — for biopsies we re-read the exams and extract portal
      if (fmSource === 'BIOPSIAS') {
        // Fetch all biopsy records (paginated) and extract communications from portal
        const allRecords = await this.fmApi.getAllRecords(
          this.communicationTransformer.biopsyDatabase,
          this.communicationTransformer.biopsyLayout,
          { dateformats: 2, portals: ['COMUNICACIONES'] },
        );

        for (const record of allRecords) {
          try {
            const comms = this.communicationTransformer.extractFromBiopsyPortal(record);
            if (comms.length === 0) continue;

            for (const comm of comms) {
              await this.persistCommunication(tenantId, fmSource, comm);
              processedCount++;
            }
          } catch (error) {
            errorCount++;
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Biopsy comm for record ${record.recordId} failed: ${msg}`);
          }
        }
      }

      // Other sources (BIOPSIASRESPALDO, PAPANICOLAOUHISTORICO) don't have separate comm data
      if (fmSource !== 'BIOPSIAS' && fmSource !== 'PAPANICOLAOU') {
        this.logger.log(`No communications to import for source ${fmSource}`);
      }

      if (batch) {
        await this.prisma.labImportBatch.update({
          where: { id: batch.id },
          data: {
            status: 'COMPLETED',
            processedCount,
            errorCount,
            completedAt: new Date(),
          },
        });
      }

      // Update run counters
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
      this.logger.error(`Communications batch failed for ${fmSource}: ${msg}`);

      if (batch) {
        try {
          await this.prisma.labImportBatch.update({
            where: { id: batch.id },
            data: {
              status: 'PENDING', // Keep PENDING so advancePhase counts it during retries
              errors: [{ error: msg }],
            },
          });
        } catch (e) {
          this.logger.error(`Failed to update batch status: ${e}`);
        }
      }

      throw error;
    }
  }

  private async persistCommunication(
    tenantId: string,
    fmSource: FmSourceType,
    comm: ExtractedCommunication,
  ): Promise<void> {
    // Find DiagnosticReport by informe number
    // For BIOPSIAS comms, the DR source is BIOPSIAS; for PAP, it's PAPANICOLAOU
    const dr = await this.prisma.labDiagnosticReport.findFirst({
      where: {
        tenantId,
        fmSource: toFmSource(fmSource),
        fmInformeNumber: comm.fkInformeNumber,
      },
    });

    if (!dr) {
      this.logger.debug(`No DR for informe ${comm.fkInformeNumber} in ${fmSource}`);
      return;
    }

    // Dedup by content + loggedAt + DR
    const existing = await this.prisma.labCommunication.findFirst({
      where: {
        tenantId,
        diagnosticReportId: dr.id,
        content: comm.content,
        loggedAt: comm.loggedAt ?? new Date(0),
      },
    });

    if (existing) return;

    await this.prisma.labCommunication.create({
      data: {
        tenantId,
        diagnosticReportId: dr.id,
        reason: comm.reason,
        content: comm.content,
        response: comm.response,
        loggedAt: comm.loggedAt ?? new Date(0),
        loggedByNameSnapshot: comm.loggedByNameSnapshot,
        category: comm.category ? toCommunicationCategory(comm.category) : null,
      },
    });
  }
}
