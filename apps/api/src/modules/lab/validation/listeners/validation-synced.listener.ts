import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AgentRunnerService } from '../services/agent-runner.service';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

interface ValidationSyncedPayload {
  validationId: string;
  tenantId: string;
  diagnosticReportId: string;
  serviceRequestId: string;
  fmSource: string;
  fmInformeNumber: number;
  exam: ExtractedExam;
  pdfBuffer: Buffer | null;
}

@Injectable()
export class ValidationSyncedListener {
  private readonly logger = new Logger(ValidationSyncedListener.name);

  constructor(private readonly runner: AgentRunnerService) {}

  @OnEvent('lab.report.validation.synced', { async: true })
  async handle(payload: ValidationSyncedPayload): Promise<void> {
    try {
      await this.runner.runAll({
        tenantId: payload.tenantId,
        validationId: payload.validationId,
        diagnosticReportId: payload.diagnosticReportId,
        exam: payload.exam,
      });
    } catch (err) {
      // Aislamiento del listener: NUNCA propagar al EventEmitter.
      // El runner ya marcó la validation como ERROR si correspondía.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[Validation ${payload.validationId}] runner failed at top level: ${msg}`,
      );
    }
  }
}
