import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  TranscriptionResult,
  TranscriptionSegment,
} from './transcription.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Target token count per chunk (approx 4 chars per token). */
const MIN_TOKENS = 400;
const MAX_TOKENS = 1000;
const CHARS_PER_TOKEN = 4;

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface RawChunk {
  content: string;
  speakerLabel: string;
  startTimeMs: number;
  endTimeMs: number;
  estimatedTokens: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ChunkingService {
  private readonly logger = new Logger(ChunkingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create semantic chunks from an interview transcription.
   *
   * Layer 1: Group segments by speaker turns.
   * Layer 2: Merge consecutive same-speaker turns; split at ~500-1000 tokens.
   * Layer 3: Generate a deterministic contextual prefix per chunk (no LLM).
   */
  async chunkInterview(
    tenantId: string,
    interviewId: string,
  ): Promise<void> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load interview with transcription and speakers
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
      include: {
        speakers: true,
        project: { select: { name: true } },
      },
    });

    if (!interview) {
      throw new NotFoundException(
        `Entrevista con id ${interviewId} no encontrada`,
      );
    }

    if (!interview.transcriptionJson) {
      throw new NotFoundException(
        `La entrevista ${interviewId} no tiene transcripción`,
      );
    }

    // 2. Parse TranscriptionResult
    const transcription =
      interview.transcriptionJson as unknown as TranscriptionResult;
    const segments = transcription.segments;

    if (!segments || segments.length === 0) {
      this.logger.warn(
        `[${interviewId}] No segments found in transcription — skipping chunking`,
      );
      return;
    }

    // Build a quick lookup: speakerLabel -> speaker record
    const speakerMap = new Map(
      interview.speakers.map((s) => [s.speakerLabel, s]),
    );

    // 3. Build raw chunks from segments (group by speaker, respect token limits)
    const rawChunks = this.buildRawChunks(segments);

    // 4. Build final chunk data with contextual prefix
    const interviewDate = interview.interviewDate
      ? interview.interviewDate.toISOString().slice(0, 10)
      : 'fecha desconocida';
    const projectName = (interview as unknown as { project: { name: string } }).project?.name ?? 'proyecto desconocido';

    const chunkData = rawChunks.map((raw, index) => {
      const speaker = speakerMap.get(raw.speakerLabel);
      const speakerName = speaker?.name ?? raw.speakerLabel;
      const speakerRole = speaker?.role ?? 'rol desconocido';
      const speakerDept = speaker?.department ?? '';

      const deptPart = speakerDept ? `, ${speakerDept}` : '';
      const contextPrefix =
        `Entrevista con ${speakerName} (${speakerRole}${deptPart}). ` +
        `Fecha: ${interviewDate}. Proyecto: ${projectName}.`;

      return {
        content: raw.content,
        contextPrefix,
        startTimeMs: raw.startTimeMs,
        endTimeMs: raw.endTimeMs,
        chunkOrder: index,
        tokenCount: raw.estimatedTokens,
        interviewId,
        speakerId: speaker?.id ?? null,
        tenantId,
      };
    });

    // 5. Delete existing chunks (reprocess support)
    await this.prisma.$executeRawUnsafe(
      `DELETE FROM interview_chunks WHERE "interviewId" = $1 AND "tenantId" = $2`,
      interviewId,
      tenantId,
    );

    // 6. Insert all chunks
    if (chunkData.length > 0) {
      await client.interviewChunk.createMany({ data: chunkData });
    }

    this.logger.log(
      `[${interviewId}] Created ${chunkData.length} chunks`,
    );
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Group transcription segments into chunks, keeping same-speaker turns
   * together and splitting when token count exceeds MAX_TOKENS.
   */
  private buildRawChunks(segments: TranscriptionSegment[]): RawChunk[] {
    const chunks: RawChunk[] = [];

    let currentSpeaker = segments[0].speaker;
    let currentTexts: string[] = [];
    let currentStartMs = segments[0].startMs;
    let currentEndMs = segments[0].endMs;
    let currentTokens = 0;

    const flush = () => {
      if (currentTexts.length === 0) return;
      const content = currentTexts.join(' ').trim();
      if (content.length === 0) return;

      chunks.push({
        content,
        speakerLabel: currentSpeaker,
        startTimeMs: currentStartMs,
        endTimeMs: currentEndMs,
        estimatedTokens: Math.ceil(content.length / CHARS_PER_TOKEN),
      });

      currentTexts = [];
      currentTokens = 0;
    };

    for (const seg of segments) {
      const segTokens = Math.ceil((seg.text?.length ?? 0) / CHARS_PER_TOKEN);

      // Speaker change — flush
      if (seg.speaker !== currentSpeaker) {
        flush();
        currentSpeaker = seg.speaker;
        currentStartMs = seg.startMs;
      }

      // Token limit exceeded — flush and start new chunk with same speaker
      if (currentTokens + segTokens > MAX_TOKENS && currentTexts.length > 0) {
        flush();
        currentSpeaker = seg.speaker;
        currentStartMs = seg.startMs;
      }

      currentTexts.push(seg.text);
      currentEndMs = seg.endMs;
      currentTokens += segTokens;
    }

    // Flush remaining
    flush();

    // Merge very small trailing chunks into previous chunk of same speaker
    const merged: RawChunk[] = [];
    for (const chunk of chunks) {
      const prev = merged[merged.length - 1];
      if (
        prev &&
        prev.speakerLabel === chunk.speakerLabel &&
        chunk.estimatedTokens < MIN_TOKENS &&
        prev.estimatedTokens + chunk.estimatedTokens <= MAX_TOKENS * 1.2
      ) {
        prev.content += ' ' + chunk.content;
        prev.endTimeMs = chunk.endTimeMs;
        prev.estimatedTokens += chunk.estimatedTokens;
      } else {
        merged.push({ ...chunk });
      }
    }

    return merged;
  }
}
