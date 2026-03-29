import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { TranscriptionService } from './transcription.service';
import { ExtractionPipelineService } from './extraction-pipeline.service';
import { CoreferenceService } from './coreference.service';
import { ChunkingService } from './chunking.service';
import { OrgEmbeddingService } from './org-embedding.service';
import { BackgroundQueueService } from '../../ai/services/background-queue.service';

@Injectable()
export class InterviewPipelineOrchestrator {
  private readonly logger = new Logger(InterviewPipelineOrchestrator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcription: TranscriptionService,
    private readonly extraction: ExtractionPipelineService,
    private readonly coreference: CoreferenceService,
    private readonly chunking: ChunkingService,
    private readonly embedding: OrgEmbeddingService,
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

      // Step 2: Extract entities (5 passes)
      this.logger.log(`[${interviewId}] Starting extraction...`);
      await this.updateStatus(interviewId, tenantId, 'EXTRACTING');
      await this.extraction.extract(tenantId, interviewId);
      this.logger.log(`[${interviewId}] Extraction complete`);

      // Step 3: Process extraction into knowledge graph
      this.logger.log(`[${interviewId}] Starting coreference resolution...`);
      await this.updateStatus(interviewId, tenantId, 'RESOLVING_COREFERENCES');
      const interview = await (
        this.prisma.forTenant(tenantId) as unknown as PrismaClient
      ).interview.findFirst({
        where: { id: interviewId, deletedAt: null },
        select: { projectId: true },
      });
      if (interview) {
        await this.coreference.processExtraction(
          tenantId,
          interviewId,
          interview.projectId,
        );
      }
      this.logger.log(`[${interviewId}] Coreference resolution complete`);

      // Step 4: Chunk transcription for RAG
      this.logger.log(`[${interviewId}] Starting chunking...`);
      await this.updateStatus(interviewId, tenantId, 'CHUNKING');
      await this.chunking.chunkInterview(tenantId, interviewId);
      this.logger.log(`[${interviewId}] Chunking complete`);

      // Step 5: Generate embeddings for chunks and entities
      this.logger.log(`[${interviewId}] Starting embedding generation...`);
      await this.updateStatus(interviewId, tenantId, 'EMBEDDING');
      await this.embedding.embedInterviewChunks(tenantId, interviewId);
      if (interview) {
        await this.embedding.embedEntities(tenantId, interview.projectId);
      }
      this.logger.log(`[${interviewId}] Embedding generation complete`);

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
