import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranscriptionService } from './transcription.service';
import { BackgroundQueueService } from '../../ai/services/background-queue.service';

@Injectable()
export class InterviewPipelineOrchestrator {
  private readonly logger = new Logger(InterviewPipelineOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcription: TranscriptionService,
    private readonly backgroundQueue: BackgroundQueueService,
  ) {}

  /**
   * Launch the full processing pipeline for an interview.
   * Runs asynchronously via BackgroundQueueService.
   */
  async launch(
    tenantId: string,
    interviewId: string,
  ): Promise<{ message: string; interviewId: string }> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Validate interview exists and has audio uploaded
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
    });

    if (!interview) {
      throw new NotFoundException('Entrevista no encontrada');
    }

    if (!interview.audioS3Key) {
      throw new BadRequestException(
        'No se ha subido audio para esta entrevista',
      );
    }

    if (
      interview.processingStatus !== 'UPLOADED' &&
      interview.processingStatus !== 'FAILED'
    ) {
      throw new BadRequestException(
        `La entrevista está en estado "${interview.processingStatus}" y no puede ser procesada`,
      );
    }

    // 2. Mark as processing
    await client.interview.update({
      where: { id: interviewId },
      data: { processingStatus: 'TRANSCRIBING', processingError: null },
    });

    // 3. Enqueue async pipeline
    this.backgroundQueue.enqueue({
      name: `interview-pipeline-${interviewId}`,
      fn: () => this.runPipeline(tenantId, interviewId),
      maxRetries: 1,
    });

    return { message: 'Pipeline iniciado', interviewId };
  }

  private async runPipeline(
    tenantId: string,
    interviewId: string,
  ): Promise<void> {
    try {
      // Step 1: Transcribe
      this.logger.log(`[${interviewId}] Starting transcription...`);
      await this.updateStatus(interviewId, tenantId, 'TRANSCRIBING');
      await this.transcription.transcribe(tenantId, interviewId);
      this.logger.log(`[${interviewId}] Transcription complete`);

      // Future steps will be added here:
      // Step 2: Post-processing (POST_PROCESSING)
      // Step 3: Extraction 5-pass (EXTRACTING)
      // Step 4: Coreference resolution (RESOLVING_COREFERENCES)
      // Step 5: Summaries (SUMMARIZING)
      // Step 6: Chunking (CHUNKING)
      // Step 7: Embeddings (EMBEDDING)

      // Mark complete
      await this.updateStatus(interviewId, tenantId, 'COMPLETED');
      this.logger.log(`[${interviewId}] Pipeline complete`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[${interviewId}] Pipeline failed: ${message}`,
        stack,
      );

      const client = this.prisma.forTenant(
        tenantId,
      ) as unknown as PrismaClient;
      await client.interview.update({
        where: { id: interviewId },
        data: {
          processingStatus: 'FAILED',
          processingError: message,
        },
      });
    }
  }

  private async updateStatus(
    interviewId: string,
    tenantId: string,
    status: string,
  ): Promise<void> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    await client.interview.update({
      where: { id: interviewId },
      data: { processingStatus: status },
    });
  }
}
