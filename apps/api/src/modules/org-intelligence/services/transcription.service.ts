import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DeepgramClient } from '@deepgram/sdk';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { DeepgramConfigService } from './deepgram-config.service';
import { AiConfigService } from '../../ai/services/ai-config.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscriptionSegment {
  speaker: string; // "Speaker_0", "Speaker_1" or identified name
  text: string;
  startMs: number;
  endMs: number;
  confidence: number; // 0-1
  speakerConfidence?: number;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  fullText: string;
  durationMs: number;
  language: string;
  speakerCount: number;
  metadata: {
    provider: 'deepgram' | 'openai';
    model: string;
    processedAt: Date;
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly deepgramConfig: DeepgramConfigService,
    private readonly aiConfig: AiConfigService,
    private readonly s3: S3Service,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Transcribe the audio attached to an Interview record.
   *
   * Strategy: try Deepgram Nova-3 first; on failure fall back to OpenAI Whisper.
   * The result is persisted on the Interview row and an AiUsageLog entry is created.
   */
  async transcribe(
    tenantId: string,
    interviewId: string,
  ): Promise<TranscriptionResult> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // 1. Load interview
    const interview = await client.interview.findFirst({
      where: { id: interviewId, deletedAt: null },
    });

    if (!interview) {
      throw new NotFoundException(
        `Entrevista con id ${interviewId} no encontrada`,
      );
    }

    if (!interview.audioS3Key) {
      throw new NotFoundException(
        `La entrevista ${interviewId} no tiene audio asociado`,
      );
    }

    // Mark as PROCESSING
    await client.interview.update({
      where: { id: interviewId },
      data: {
        transcriptionStatus: 'PROCESSING',
        processingStatus: 'PROCESSING',
      },
    });

    // 2. Download audio from S3
    const { buffer: audioBuffer, contentType: mimeType } =
      await this.s3.download(tenantId, interview.audioS3Key);

    // 3. Transcribe: Deepgram first, OpenAI fallback
    let result: TranscriptionResult;
    let deepgramError: unknown;

    try {
      const apiKey = await this.deepgramConfig.getApiKey(tenantId);
      result = await this.transcribeWithDeepgram(audioBuffer, mimeType, apiKey);
      this.logger.log(
        `Deepgram transcription succeeded for interview ${interviewId}`,
      );
    } catch (err) {
      deepgramError = err;
      this.logger.warn(
        `Deepgram transcription failed for interview ${interviewId}, falling back to OpenAI: ${(err as Error).message}`,
      );

      try {
        result = await this.transcribeWithOpenAI(
          audioBuffer,
          mimeType,
          tenantId,
        );
        this.logger.log(
          `OpenAI transcription succeeded for interview ${interviewId}`,
        );
      } catch (openaiErr) {
        // Both providers failed
        const errorMessage =
          `Deepgram error: ${(deepgramError as Error).message}; ` +
          `OpenAI error: ${(openaiErr as Error).message}`;

        this.logger.error(
          `All transcription providers failed for interview ${interviewId}: ${errorMessage}`,
        );

        await client.interview.update({
          where: { id: interviewId },
          data: {
            transcriptionStatus: 'FAILED',
            processingStatus: 'FAILED',
            processingError: errorMessage,
          },
        });

        throw new Error(
          `Transcription failed for interview ${interviewId}: ${errorMessage}`,
        );
      }
    }

    // 4. Log AI usage
    await this.logUsage(
      tenantId,
      result.metadata.provider === 'deepgram' ? 'DEEPGRAM' : 'OPENAI',
      result.metadata.model,
      result.durationMs,
      interviewId,
    );

    // 5. Persist transcription on Interview
    await client.interview.update({
      where: { id: interviewId },
      data: {
        transcriptionText: result.fullText,
        transcriptionJson: result as unknown as Record<string, unknown>,
        transcriptionStatus: 'COMPLETED',
        transcriptionProvider:
          result.metadata.provider === 'deepgram' ? 'DEEPGRAM' : 'OPENAI',
        audioDurationMs: result.durationMs,
        processingStatus: 'TRANSCRIBED',
      },
    });

    return result;
  }

  // -----------------------------------------------------------------------
  // Deepgram (primary)
  // -----------------------------------------------------------------------

  private async transcribeWithDeepgram(
    audioBuffer: Buffer,
    _mimeType: string,
    apiKey: string,
  ): Promise<TranscriptionResult> {
    const dgClient = new DeepgramClient({ apiKey });

    const response = await dgClient.listen.v1.media.transcribeFile(
      audioBuffer,
      {
        model: 'nova-3',
        language: 'es',
        diarize: true,
        smart_format: true,
        punctuate: true,
        utterances: true,
      },
    );

    // The SDK v5 HttpResponsePromise resolves directly to the result object
    const result = response;

    if (!('results' in result)) {
      throw new Error('Deepgram returned an unexpected response shape');
    }

    const utterances = result.results?.utterances ?? [];
    const metadata = result.metadata;
    const durationMs = Math.round((metadata?.duration ?? 0) * 1000);

    // Detect language from the first channel if available
    const detectedLanguage =
      result.results?.channels?.[0]?.detected_language ?? 'es';

    // Build segments from utterances
    const speakerSet = new Set<number>();
    const segments: TranscriptionSegment[] = utterances.map((utt) => {
      const speaker = utt.speaker ?? 0;
      speakerSet.add(speaker);

      // Compute average speaker_confidence from words
      const words = utt.words ?? [];
      const avgSpeakerConf =
        words.length > 0
          ? words.reduce(
              (sum, w) => sum + (w.speaker_confidence ?? 0),
              0,
            ) / words.length
          : undefined;

      return {
        speaker: `Speaker_${speaker}`,
        text: utt.transcript ?? '',
        startMs: Math.round((utt.start ?? 0) * 1000),
        endMs: Math.round((utt.end ?? 0) * 1000),
        confidence: utt.confidence ?? 0,
        ...(avgSpeakerConf !== undefined
          ? { speakerConfidence: avgSpeakerConf }
          : {}),
      };
    });

    const fullText = segments.map((s) => s.text).join(' ');

    return {
      segments,
      fullText,
      durationMs,
      language: detectedLanguage,
      speakerCount: speakerSet.size || 1,
      metadata: {
        provider: 'deepgram',
        model: 'nova-3',
        processedAt: new Date(),
      },
    };
  }

  // -----------------------------------------------------------------------
  // OpenAI (fallback)
  // -----------------------------------------------------------------------

  private async transcribeWithOpenAI(
    audioBuffer: Buffer,
    mimeType: string,
    tenantId: string,
  ): Promise<TranscriptionResult> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      throw new Error(
        `No OpenAI API key configured for tenant ${tenantId}`,
      );
    }

    const openai = new OpenAI({ apiKey });

    // Determine file extension from mime type
    const extMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/x-wav': 'wav',
      'audio/mp4': 'mp4',
      'audio/x-m4a': 'm4a',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
    };
    const ext = extMap[mimeType] ?? 'mp3';

    const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'es',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });

    // verbose_json returns segments with start/end timestamps
    const rawSegments =
      (response as unknown as { segments?: OpenAISegment[] }).segments ?? [];

    const durationMs = Math.round((response.duration ?? 0) * 1000);

    const segments: TranscriptionSegment[] = rawSegments.map((seg) => ({
      speaker: 'Speaker_0', // Whisper does not support diarization
      text: seg.text ?? '',
      startMs: Math.round((seg.start ?? 0) * 1000),
      endMs: Math.round((seg.end ?? 0) * 1000),
      confidence: seg.avg_logprob != null ? Math.exp(seg.avg_logprob) : 0,
    }));

    const fullText = response.text ?? '';

    return {
      segments,
      fullText,
      durationMs,
      language: response.language ?? 'es',
      speakerCount: 1, // Whisper has no diarization
      metadata: {
        provider: 'openai',
        model: 'whisper-1',
        processedAt: new Date(),
      },
    };
  }

  // -----------------------------------------------------------------------
  // Usage logging
  // -----------------------------------------------------------------------

  private async logUsage(
    tenantId: string,
    provider: string,
    model: string,
    durationMs: number,
    _interviewId: string,
  ): Promise<void> {
    try {
      // For audio transcription, tokens don't directly apply.
      // We approximate: inputTokens ≈ audio seconds (rough proxy for billing),
      // outputTokens ≈ transcript char count / 4 (rough token estimate).
      const audioDurationSec = Math.round(durationMs / 1000);

      await this.prisma.aiUsageLog.create({
        data: {
          provider,
          model,
          feature: 'org-transcription',
          inputTokens: audioDurationSec,
          outputTokens: 0,
          totalTokens: audioDurationSec,
          cachedTokens: 0,
          compacted: false,
          tenantId,
        },
      });
    } catch (err) {
      // Non-critical — log but don't fail the transcription
      this.logger.warn(
        `Failed to log AI usage for transcription: ${(err as Error).message}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Helper type for OpenAI verbose_json response segments
// ---------------------------------------------------------------------------

interface OpenAISegment {
  id?: number;
  start?: number;
  end?: number;
  text?: string;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
}
