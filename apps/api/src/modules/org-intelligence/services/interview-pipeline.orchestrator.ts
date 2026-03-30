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
import { PipelineEventsService } from './pipeline-events.service';
import {
  PROCESSING_STATUS_MESSAGES,
  type ProcessingStatus,
  type PipelineLogEntry,
  type PipelineEvent,
} from '@zeru/shared';

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
    private readonly pipelineEvents: PipelineEventsService,
  ) {}

  /**
   * Launch the full processing pipeline for an interview.
   * Runs asynchronously via BackgroundQueueService.
   */
  /** Ordered pipeline steps — used to resolve fromStep parameter */
  private static readonly PIPELINE_STEPS = [
    'TRANSCRIBING',
    'EXTRACTING',
    'RESOLVING_COREFERENCES',
    'CHUNKING',
    'EMBEDDING',
  ] as const;

  async launch(
    tenantId: string,
    interviewId: string,
    fromStep?: string,
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
      interview.processingStatus !== 'FAILED' &&
      interview.processingStatus !== 'COMPLETED'
    ) {
      throw new BadRequestException(
        `La entrevista está en estado "${interview.processingStatus}" y no puede ser procesada`,
      );
    }

    // Resolve starting step index
    let startStep = 0;
    if (fromStep) {
      const upper = fromStep.toUpperCase();
      const idx = InterviewPipelineOrchestrator.PIPELINE_STEPS.indexOf(
        upper as (typeof InterviewPipelineOrchestrator.PIPELINE_STEPS)[number],
      );
      if (idx === -1) {
        throw new BadRequestException(
          `Paso inválido "${fromStep}". Pasos válidos: ${InterviewPipelineOrchestrator.PIPELINE_STEPS.join(', ')}`,
        );
      }
      startStep = idx;
    }

    // 2. Initialise the SSE subject so clients can connect immediately
    this.pipelineEvents.getOrCreate(interviewId);

    // 3. Mark as processing
    await this.updateStatus(
      interviewId,
      tenantId,
      InterviewPipelineOrchestrator.PIPELINE_STEPS[startStep] as ProcessingStatus,
    );

    // 4. Enqueue async pipeline
    this.backgroundQueue.enqueue({
      name: `interview-pipeline-${interviewId}`,
      fn: () => this.runPipeline(tenantId, interviewId, startStep),
      maxRetries: 1,
    });

    return { message: 'Pipeline iniciado', interviewId };
  }

  private async runPipeline(
    tenantId: string,
    interviewId: string,
    startStep = 0,
  ): Promise<void> {
    try {
      const steps = InterviewPipelineOrchestrator.PIPELINE_STEPS;
      if (startStep > 0) {
        this.logger.log(
          `[${interviewId}] Resuming pipeline from step ${steps[startStep]}`,
        );
      }

      // Step 0: Transcribe
      if (startStep <= 0) {
        this.logger.log(`[${interviewId}] Starting transcription...`);
        await this.updateStatus(interviewId, tenantId, 'TRANSCRIBING');
        await this.transcription.transcribe(tenantId, interviewId);
        this.logger.log(`[${interviewId}] Transcription complete`);
      }

      // Step 1: Extract entities (5 passes)
      if (startStep <= 1) {
        this.logger.log(`[${interviewId}] Starting extraction...`);
        await this.updateStatus(interviewId, tenantId, 'EXTRACTING');
        const extractionResult = await this.extraction.extract(
          tenantId,
          interviewId,
        );
        if (extractionResult.metadata.completedPasses.length === 0) {
          throw new Error(
            'La extracción de conocimiento falló en todas las pasadas. Verifica la configuración de OpenAI.',
          );
        }
        this.logger.log(
          `[${interviewId}] Extraction complete (${extractionResult.metadata.completedPasses.length}/5 passes)`,
        );
      }

      // Fetch project for steps that need it
      const interview = await (
        this.prisma.forTenant(tenantId) as unknown as PrismaClient
      ).interview.findFirst({
        where: { id: interviewId, deletedAt: null },
        select: { projectId: true },
      });

      // Step 2: Process extraction into knowledge graph
      if (startStep <= 2) {
        this.logger.log(`[${interviewId}] Starting coreference resolution...`);
        await this.updateStatus(interviewId, tenantId, 'RESOLVING_COREFERENCES');
        if (interview) {
          await this.coreference.processExtraction(
            tenantId,
            interviewId,
            interview.projectId,
          );
        }
        this.logger.log(`[${interviewId}] Coreference resolution complete`);
      }

      // Step 3: Chunk transcription for RAG
      if (startStep <= 3) {
        this.logger.log(`[${interviewId}] Starting chunking...`);
        await this.updateStatus(interviewId, tenantId, 'CHUNKING');
        await this.chunking.chunkInterview(tenantId, interviewId);
        this.logger.log(`[${interviewId}] Chunking complete`);
      }

      // Step 4: Generate embeddings for chunks and entities
      if (startStep <= 4) {
        this.logger.log(`[${interviewId}] Starting embedding generation...`);
        await this.updateStatus(interviewId, tenantId, 'EMBEDDING');
        await this.embedding.embedInterviewChunks(tenantId, interviewId);
        if (interview) {
          await this.embedding.embedEntities(tenantId, interview.projectId);
        }
        this.logger.log(`[${interviewId}] Embedding generation complete`);
      }

      // Mark complete
      await this.updateStatus(interviewId, tenantId, 'COMPLETED');
      this.logger.log(`[${interviewId}] Pipeline complete`);

      // Close SSE stream
      this.pipelineEvents.complete(interviewId);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      const stack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `[${interviewId}] Pipeline failed: ${message}`,
        stack,
      );

      await this.updateStatus(interviewId, tenantId, 'FAILED', message);

      // Close SSE stream
      this.pipelineEvents.complete(interviewId);
    }
  }

  private async updateStatus(
    interviewId: string,
    tenantId: string,
    status: ProcessingStatus,
    errorMessage?: string,
  ): Promise<void> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const statusMessage =
      status === 'FAILED' && errorMessage
        ? `${PROCESSING_STATUS_MESSAGES.FAILED}: ${errorMessage}`
        : PROCESSING_STATUS_MESSAGES[status];

    // Build the new log entry
    const logEntry: PipelineLogEntry = {
      status,
      message: statusMessage,
      timestamp: new Date().toISOString(),
    };

    // Read existing log from DB so we append (not overwrite)
    const current = await client.interview.findUnique({
      where: { id: interviewId },
      select: { processingLog: true },
    });
    const existingLog = Array.isArray(current?.processingLog)
      ? (current.processingLog as unknown as PipelineLogEntry[])
      : [];

    // If we're starting fresh (TRANSCRIBING is first real step), reset the log
    const log = status === 'TRANSCRIBING' ? [logEntry] : [...existingLog, logEntry];

    await client.interview.update({
      where: { id: interviewId },
      data: {
        processingStatus: status,
        processingError: status === 'FAILED' ? (errorMessage ?? null) : null,
        processingLog: log as unknown as object[],
      },
    });

    // Emit SSE event
    const event: PipelineEvent = {
      type: 'pipeline:status',
      interviewId,
      status,
      message: statusMessage,
      timestamp: logEntry.timestamp,
    };
    this.pipelineEvents.emit(interviewId, event);
  }
}
