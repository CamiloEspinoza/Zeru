# Multi-Audio Interview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support uploading two audio files per interview (iPhone + MacBook), automatically synchronize and merge them into stereo, and use Deepgram multichannel for deterministic speaker identification.

**Architecture:** New `InterviewAudioTrack` model stores original tracks. New `AudioMergeService` handles sync (cross-correlation) + merge (ffmpeg stereo). Pipeline gains a MERGING step that pauses for preview. TranscriptionService switches to `multichannel=true` when stereo. Frontend expands upload UI to accept 2 files.

**Tech Stack:** Prisma migration, ffmpeg (loudnorm + stereo merge), Node.js cross-correlation, Deepgram Nova-3 multichannel, NestJS, Next.js

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `apps/api/prisma/schema.prisma` | Modify | Add InterviewAudioTrack model |
| `packages/shared/src/org-intelligence.ts` | Modify | Add MERGING, MERGE_REVIEW statuses |
| `apps/api/src/modules/org-intelligence/services/audio-merge.service.ts` | Create | Sync detection + ffmpeg stereo merge |
| `apps/api/src/modules/org-intelligence/services/transcription.service.ts` | Modify | Multichannel mode when stereo |
| `apps/api/src/modules/org-intelligence/services/interview-pipeline.orchestrator.ts` | Modify | Add MERGING step + MERGE_REVIEW pause |
| `apps/api/src/modules/org-intelligence/services/interviews.service.ts` | Modify | Upload with trackOrder, track management |
| `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts` | Modify | trackOrder query param on upload |
| `apps/api/src/modules/org-intelligence/org-intelligence.module.ts` | Modify | Register AudioMergeService |
| `apps/web/components/org-intelligence/interview-audio-step.tsx` | Modify | Multi-file upload UI |

---

### Task 1: Prisma Schema + Shared Types

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Modify: `packages/shared/src/org-intelligence.ts`

- [ ] **Step 1: Add InterviewAudioTrack model to schema**

In `apps/api/prisma/schema.prisma`, add after the `Interview` model (after its closing brace, before `InterviewSpeaker`):

```prisma
model InterviewAudioTrack {
  id            String   @id @default(uuid())
  interviewId   String
  interview     Interview @relation(fields: [interviewId], references: [id], onDelete: Cascade)
  trackOrder    Int
  s3Key         String
  mimeType      String   @default("audio/mpeg")
  durationMs    Int?
  sourceLabel   String?
  originalName  String?
  createdAt     DateTime @default(now())
  tenantId      String

  @@unique([interviewId, trackOrder])
  @@index([interviewId])
  @@map("interview_audio_tracks")
}
```

Add relation to the Interview model (after `chunks InterviewChunk[]`):

```prisma
  audioTracks   InterviewAudioTrack[]
```

- [ ] **Step 2: Add MERGING and MERGE_REVIEW to shared processing statuses**

In `packages/shared/src/org-intelligence.ts`, update `PROCESSING_STATUSES` array (line 19-23):

```typescript
export const PROCESSING_STATUSES = [
  'PENDING', 'UPLOADED', 'MERGING', 'MERGE_REVIEW', 'TRANSCRIBING', 'POST_PROCESSING',
  'EXTRACTING', 'RESOLVING_COREFERENCES', 'SUMMARIZING',
  'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED',
] as const;
```

Add messages for the new statuses in `PROCESSING_STATUS_MESSAGES` (after line 29 `UPLOADED`):

```typescript
  MERGING: 'Mezclando y sincronizando audios de múltiples fuentes',
  MERGE_REVIEW: 'Audio mezclado listo para revisión — escucha el resultado antes de continuar',
```

- [ ] **Step 3: Run migration**

```bash
cd apps/api && npx prisma migrate dev --name add_interview_audio_tracks
```

- [ ] **Step 4: Generate client and build shared**

```bash
cd apps/api && npx prisma generate
cd packages/shared && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/ packages/shared/ && git commit -m "feat: add InterviewAudioTrack model and MERGING pipeline statuses"
```

---

### Task 2: AudioMergeService

**Files:**
- Create: `apps/api/src/modules/org-intelligence/services/audio-merge.service.ts`
- Modify: `apps/api/src/modules/org-intelligence/org-intelligence.module.ts`

- [ ] **Step 1: Create AudioMergeService**

Create `apps/api/src/modules/org-intelligence/services/audio-merge.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execFileAsync = promisify(execFile);

@Injectable()
export class AudioMergeService {
  private readonly logger = new Logger(AudioMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  /**
   * Merge two audio tracks into an aligned stereo WAV.
   * Track 1 = left channel, Track 2 = right channel.
   */
  async mergeAndAlign(
    tenantId: string,
    interviewId: string,
  ): Promise<{ mergedS3Key: string; offsetMs: number }> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const tracks = await client.interviewAudioTrack.findMany({
      where: { interviewId },
      orderBy: { trackOrder: 'asc' },
    });

    if (tracks.length < 2) {
      throw new Error('Need at least 2 tracks to merge');
    }

    const tmpDir = await mkdtemp(join(tmpdir(), 'zeru-merge-'));
    const track1Path = join(tmpDir, 'track1.mp3');
    const track2Path = join(tmpDir, 'track2.mp3');
    const track1Norm = join(tmpDir, 'track1_norm.wav');
    const track2Norm = join(tmpDir, 'track2_norm.wav');
    const track1Raw = join(tmpDir, 'track1.raw');
    const track2Raw = join(tmpDir, 'track2.raw');
    const mergedPath = join(tmpDir, 'merged.wav');

    try {
      // 1. Download tracks from S3
      const [buf1, buf2] = await Promise.all([
        this.s3.download(tenantId, tracks[0].s3Key).then((r) => r.buffer),
        this.s3.download(tenantId, tracks[1].s3Key).then((r) => r.buffer),
      ]);
      await Promise.all([
        writeFile(track1Path, buf1),
        writeFile(track2Path, buf2),
      ]);

      // 2. Normalize levels + resample to 16kHz mono WAV
      await Promise.all([
        execFileAsync('ffmpeg', [
          '-y', '-i', track1Path,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
          '-ar', '16000', '-ac', '1', track1Norm,
        ]),
        execFileAsync('ffmpeg', [
          '-y', '-i', track2Path,
          '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
          '-ar', '16000', '-ac', '1', track2Norm,
        ]),
      ]);

      // 3. Detect offset via cross-correlation
      const offsetSeconds = await this.detectOffset(
        track1Norm, track2Norm, track1Raw, track2Raw,
      );
      this.logger.log(
        `[${interviewId}] Detected offset: ${offsetSeconds.toFixed(2)}s`,
      );

      // 4. Merge into stereo WAV with offset
      const offsetArg = Math.abs(offsetSeconds).toFixed(3);
      if (offsetSeconds >= 0) {
        // Track 2 starts later — delay track 2
        await execFileAsync('ffmpeg', [
          '-y', '-i', track1Norm,
          '-itsoffset', offsetArg, '-i', track2Norm,
          '-filter_complex',
          '[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]',
          '-map', '[a]', '-ar', '16000', mergedPath,
        ]);
      } else {
        // Track 1 starts later — delay track 1
        await execFileAsync('ffmpeg', [
          '-y',
          '-itsoffset', offsetArg, '-i', track1Norm,
          '-i', track2Norm,
          '-filter_complex',
          '[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]',
          '-map', '[a]', '-ar', '16000', mergedPath,
        ]);
      }

      // 5. Upload merged to S3
      const mergedBuffer = await readFile(mergedPath);
      const mergedS3Key = `tenants/${tenantId}/interviews/${interviewId}/audio/merged.wav`;
      await this.s3.upload(tenantId, mergedS3Key, mergedBuffer, 'audio/wav');

      // 6. Update interview
      await client.interview.update({
        where: { id: interviewId },
        data: {
          audioS3Key: mergedS3Key,
          audioMimeType: 'audio/wav',
        },
      });

      return { mergedS3Key, offsetMs: Math.round(offsetSeconds * 1000) };
    } finally {
      // Cleanup temp files
      const files = [track1Path, track2Path, track1Norm, track2Norm, track1Raw, track2Raw, mergedPath];
      await Promise.allSettled(files.map((f) => unlink(f).catch(() => {})));
      await unlink(tmpDir).catch(() => {});
    }
  }

  /**
   * Detect time offset between two audio files using cross-correlation.
   * Extracts first 180s as raw PCM at 8kHz, computes correlation.
   */
  private async detectOffset(
    track1Wav: string,
    track2Wav: string,
    track1Raw: string,
    track2Raw: string,
  ): Promise<number> {
    const sampleRate = 8000;
    const maxSeconds = 180;

    // Extract first 3 minutes as raw 32-bit float PCM at 8kHz
    await Promise.all([
      execFileAsync('ffmpeg', [
        '-y', '-i', track1Wav, '-t', String(maxSeconds),
        '-ar', String(sampleRate), '-ac', '1', '-f', 'f32le', track1Raw,
      ]),
      execFileAsync('ffmpeg', [
        '-y', '-i', track2Wav, '-t', String(maxSeconds),
        '-ar', String(sampleRate), '-ac', '1', '-f', 'f32le', track2Raw,
      ]),
    ]);

    const [raw1, raw2] = await Promise.all([
      readFile(track1Raw),
      readFile(track2Raw),
    ]);

    const samples1 = new Float32Array(raw1.buffer, raw1.byteOffset, raw1.byteLength / 4);
    const samples2 = new Float32Array(raw2.buffer, raw2.byteOffset, raw2.byteLength / 4);

    // First try: detect clap/palmada (loud peak in first 60s)
    const clapOffset = this.detectClapOffset(samples1, samples2, sampleRate);
    if (clapOffset !== null) {
      this.logger.log('Offset detected via clap/peak detection');
      return clapOffset;
    }

    // Fallback: cross-correlation on downsampled signal
    this.logger.log('No clap detected, using cross-correlation');
    return this.crossCorrelate(samples1, samples2, sampleRate);
  }

  /**
   * Detect offset via loud peak (clap/palmada) in first 60 seconds.
   * Returns offset in seconds or null if no clear peak found.
   */
  private detectClapOffset(
    samples1: Float32Array,
    samples2: Float32Array,
    sampleRate: number,
  ): number | null {
    const searchSamples = sampleRate * 60; // first 60 seconds

    const findPeak = (samples: Float32Array): number | null => {
      const len = Math.min(samples.length, searchSamples);
      let maxVal = 0;
      let maxIdx = 0;
      let sum = 0;

      for (let i = 0; i < len; i++) {
        const abs = Math.abs(samples[i]);
        sum += abs;
        if (abs > maxVal) {
          maxVal = abs;
          maxIdx = i;
        }
      }

      const avg = sum / len;
      // Peak must be at least 6x the average (clear spike)
      if (maxVal > avg * 6) return maxIdx;
      return null;
    };

    const peak1 = findPeak(samples1);
    const peak2 = findPeak(samples2);

    if (peak1 === null || peak2 === null) return null;

    return (peak1 - peak2) / sampleRate;
  }

  /**
   * Cross-correlate two signals to find the best alignment offset.
   * Downsamples to 1kHz for performance (~180k samples max).
   */
  private crossCorrelate(
    samples1: Float32Array,
    samples2: Float32Array,
    sampleRate: number,
  ): number {
    // Downsample to 1kHz for speed
    const factor = Math.max(1, Math.floor(sampleRate / 1000));
    const ds1 = this.downsample(samples1, factor);
    const ds2 = this.downsample(samples2, factor);
    const dsRate = sampleRate / factor;

    // Max lag: ±60 seconds
    const maxLag = Math.floor(dsRate * 60);

    let bestLag = 0;
    let bestCorr = -Infinity;

    const len = Math.min(ds1.length, ds2.length);

    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let sum = 0;
      let count = 0;
      for (let i = 0; i < len; i++) {
        const j = i + lag;
        if (j >= 0 && j < ds2.length) {
          sum += ds1[i] * ds2[j];
          count++;
        }
      }
      if (count > 0) {
        const corr = sum / count;
        if (corr > bestCorr) {
          bestCorr = corr;
          bestLag = lag;
        }
      }
    }

    return bestLag / dsRate;
  }

  private downsample(samples: Float32Array, factor: number): Float32Array {
    const len = Math.floor(samples.length / factor);
    const result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = samples[i * factor];
    }
    return result;
  }
}
```

- [ ] **Step 2: Register AudioMergeService in module**

In `apps/api/src/modules/org-intelligence/org-intelligence.module.ts`:

Add import:
```typescript
import { AudioMergeService } from './services/audio-merge.service';
```

Add `AudioMergeService` to both `providers` and `exports` arrays.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/org-intelligence/ && git commit -m "feat: add AudioMergeService with cross-correlation sync and stereo merge"
```

---

### Task 3: Update Upload Endpoint for Multi-Track

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/services/interviews.service.ts`
- Modify: `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`

- [ ] **Step 1: Update uploadAudio in interviews.service.ts**

Add after the existing `uploadAudio` method (line ~204):

```typescript
async uploadAudioTrack(
  tenantId: string,
  interviewId: string,
  file: Express.Multer.File,
  trackOrder: number,
  sourceLabel?: string,
) {
  if (!ALLOWED_AUDIO_MIMETYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      `Tipo de archivo no permitido: ${file.mimetype}`,
    );
  }

  await this.findOne(tenantId, interviewId);

  const normalized = await this.normalizeAudio(file.buffer, file.originalname);
  const outName = file.originalname.replace(/\.[^.]+$/, '.mp3');
  const key = `tenants/${tenantId}/interviews/${interviewId}/audio/track-${trackOrder}-${outName}`;
  await this.s3.upload(tenantId, key, normalized, 'audio/mpeg');

  const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

  // Upsert track (replace if same trackOrder)
  await client.interviewAudioTrack.upsert({
    where: { interviewId_trackOrder: { interviewId, trackOrder } },
    create: {
      interviewId,
      trackOrder,
      s3Key: key,
      mimeType: 'audio/mpeg',
      sourceLabel,
      originalName: file.originalname,
      tenantId,
    },
    update: {
      s3Key: key,
      sourceLabel,
      originalName: file.originalname,
    },
  });

  // If this is track 1, also set as main audioS3Key for backward compat
  if (trackOrder === 1) {
    await client.interview.update({
      where: { id: interviewId },
      data: {
        audioS3Key: key,
        audioMimeType: 'audio/mpeg',
        processingStatus: 'UPLOADED',
      },
    });
  } else {
    // Track 2 uploaded — reset to UPLOADED so pipeline can re-run
    await client.interview.update({
      where: { id: interviewId },
      data: { processingStatus: 'UPLOADED' },
    });
  }

  const tracks = await client.interviewAudioTrack.findMany({
    where: { interviewId },
    orderBy: { trackOrder: 'asc' },
  });

  return { tracks };
}

async getAudioTracks(tenantId: string, interviewId: string) {
  await this.findOne(tenantId, interviewId);
  const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
  return client.interviewAudioTrack.findMany({
    where: { interviewId },
    orderBy: { trackOrder: 'asc' },
  });
}

async deleteAudioTrack(tenantId: string, interviewId: string, trackOrder: number) {
  await this.findOne(tenantId, interviewId);
  const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
  await client.interviewAudioTrack.delete({
    where: { interviewId_trackOrder: { interviewId, trackOrder } },
  });
  return { message: 'Track eliminado' };
}
```

- [ ] **Step 2: Update controller for trackOrder**

In `apps/api/src/modules/org-intelligence/controllers/interviews.controller.ts`, modify the existing `uploadAudio` endpoint to accept `trackOrder` and `sourceLabel` as query params:

```typescript
@Post(':id/upload-audio')
@UseGuards(JwtAuthGuard, TenantGuard)
@UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
async uploadAudio(
  @CurrentTenant() tenantId: string,
  @Param('id') id: string,
  @UploadedFile() file: Express.Multer.File,
  @Query('trackOrder') trackOrderStr?: string,
  @Query('sourceLabel') sourceLabel?: string,
) {
  const trackOrder = trackOrderStr ? parseInt(trackOrderStr, 10) : undefined;
  if (trackOrder !== undefined && (trackOrder < 1 || trackOrder > 2)) {
    throw new BadRequestException('trackOrder must be 1 or 2');
  }

  if (trackOrder) {
    return this.interviewsService.uploadAudioTrack(
      tenantId, id, file, trackOrder, sourceLabel,
    );
  }
  // Backward compatible: no trackOrder = single file upload (legacy)
  return this.interviewsService.uploadAudio(tenantId, id, file);
}
```

Add a GET endpoint for tracks:

```typescript
@Get(':id/audio-tracks')
@UseGuards(JwtAuthGuard, TenantGuard)
async getAudioTracks(
  @CurrentTenant() tenantId: string,
  @Param('id') id: string,
) {
  return this.interviewsService.getAudioTracks(tenantId, id);
}
```

Add `BadRequestException` to the imports from `@nestjs/common` if not already there. Add `Query` to the imports from `@nestjs/common`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/org-intelligence/ && git commit -m "feat: add multi-track audio upload with trackOrder support"
```

---

### Task 4: Update Pipeline Orchestrator

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/services/interview-pipeline.orchestrator.ts`

- [ ] **Step 1: Add MERGING step and AudioMergeService injection**

Add import:
```typescript
import { AudioMergeService } from './audio-merge.service';
```

Add to constructor:
```typescript
private readonly audioMerge: AudioMergeService,
```

Update `PIPELINE_STEPS`:
```typescript
private static readonly PIPELINE_STEPS = [
  'MERGING',
  'TRANSCRIBING',
  'EXTRACTING',
  'RESOLVING_COREFERENCES',
  'CHUNKING',
  'EMBEDDING',
] as const;
```

- [ ] **Step 2: Add MERGING step to runPipeline**

Replace the existing Step 0 (TRANSCRIBING) block with:

```typescript
      // Step 0: Merge audio tracks (if multi-track)
      if (startStep <= 0) {
        const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
        const trackCount = await client.interviewAudioTrack.count({
          where: { interviewId },
        });

        if (trackCount >= 2) {
          this.logger.log(`[${interviewId}] Merging ${trackCount} audio tracks...`);
          await this.updateStatus(interviewId, tenantId, 'MERGING');
          const { offsetMs } = await this.audioMerge.mergeAndAlign(tenantId, interviewId);
          this.logger.log(`[${interviewId}] Merge complete (offset: ${offsetMs}ms)`);

          // Pause for review
          await this.updateStatus(interviewId, tenantId, 'MERGE_REVIEW');
          this.pipelineEvents.emit(interviewId, {
            type: 'pipeline:status',
            interviewId,
            status: 'MERGE_REVIEW',
            message: `Audio mezclado listo (offset: ${(offsetMs / 1000).toFixed(1)}s). Escucha el resultado y continúa.`,
            timestamp: new Date().toISOString(),
          });
          return; // Pipeline pauses — user resumes with fromStep=TRANSCRIBING
        }
      }

      // Step 1: Transcribe
      if (startStep <= 1) {
        this.logger.log(`[${interviewId}] Starting transcription...`);
        await this.updateStatus(interviewId, tenantId, 'TRANSCRIBING');
        await this.transcription.transcribe(tenantId, interviewId);
        this.logger.log(`[${interviewId}] Transcription complete`);

        // Auto-identify speakers from introductions
        this.logger.log(`[${interviewId}] Identifying speakers...`);
        await this.transcription.identifySpeakers(tenantId, interviewId);
        this.logger.log(`[${interviewId}] Speaker identification complete`);
      }
```

Update all subsequent step indices (`startStep <= 2` for EXTRACTING, `startStep <= 3` for RESOLVING_COREFERENCES, etc.) — increment each by 1.

- [ ] **Step 3: Add PrismaClient import if not present**

```typescript
import { PrismaClient } from '@prisma/client';
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/org-intelligence/services/interview-pipeline.orchestrator.ts && git commit -m "feat: add MERGING pipeline step with MERGE_REVIEW pause"
```

---

### Task 5: Update TranscriptionService for Multichannel

**Files:**
- Modify: `apps/api/src/modules/org-intelligence/services/transcription.service.ts`

- [ ] **Step 1: Add multichannel support to transcribeWithDeepgram**

Modify the `transcribe` method to detect multi-track and pass that info down. After loading the interview (line ~75), count tracks:

```typescript
const trackCount = await client.interviewAudioTrack.count({
  where: { interviewId },
});
const useMultichannel = trackCount >= 2;
```

Pass `useMultichannel` to `transcribeWithDeepgram`:

```typescript
result = await this.transcribeWithDeepgram(audioBuffer, mimeType, apiKey, useMultichannel);
```

Update `transcribeWithDeepgram` signature:

```typescript
private async transcribeWithDeepgram(
  audioBuffer: Buffer,
  _mimeType: string,
  apiKey: string,
  multichannel = false,
): Promise<TranscriptionResult> {
```

Update the Deepgram options:

```typescript
const response = await dgClient.listen.v1.media.transcribeFile(
  audioBuffer,
  {
    model: 'nova-3',
    language: 'es',
    ...(multichannel
      ? { multichannel: true }
      : { diarize: true }),
    smart_format: true,
    punctuate: true,
    utterances: true,
  },
);
```

- [ ] **Step 2: Handle multichannel response**

When `multichannel` is true, build segments from `utterances` using `channel` instead of `speaker`:

After the existing segment-building code (line ~218), add a branch:

```typescript
if (multichannel && utterances.length > 0) {
  // Multichannel: use channel as speaker identifier
  const channelSet = new Set<number>();
  const mcSegments: TranscriptionSegment[] = utterances.map((utt) => {
    const channel = utt.channel ?? 0;
    channelSet.add(channel);

    const words = utt.words ?? [];
    const mappedWords: TranscriptionWord[] = words.map((w) => ({
      word: w.word ?? '',
      punctuatedWord: w.punctuated_word ?? w.word ?? '',
      startMs: Math.round((w.start ?? 0) * 1000),
      endMs: Math.round((w.end ?? 0) * 1000),
      confidence: w.confidence ?? 0,
    }));

    return {
      speaker: `Speaker_Track${channel + 1}`,
      text: utt.transcript ?? '',
      startMs: Math.round((utt.start ?? 0) * 1000),
      endMs: Math.round((utt.end ?? 0) * 1000),
      confidence: utt.confidence ?? 0,
      words: mappedWords,
    };
  });

  const mcFullText = mcSegments.map((s) => s.text).join(' ');

  return {
    segments: mcSegments,
    fullText: mcFullText,
    durationMs,
    language: detectedLanguage,
    speakerCount: channelSet.size || 1,
    metadata: {
      provider: 'deepgram',
      model: 'nova-3',
      processedAt: new Date(),
    },
  };
}
```

Place this block BEFORE the existing mono segment-building code, so it returns early when multichannel.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/org-intelligence/services/transcription.service.ts && git commit -m "feat: add Deepgram multichannel transcription for multi-track interviews"
```

---

### Task 6: Frontend — Multi-File Upload UI

**Files:**
- Modify: `apps/web/components/org-intelligence/interview-audio-step.tsx`

- [ ] **Step 1: Rewrite InterviewAudioStep for multi-track**

Replace the entire content of `interview-audio-step.tsx`:

```tsx
"use client";

import { useRef, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TENANT_HEADER } from "@zeru/shared";
import { useAudioRecorder } from "./use-audio-recorder";
import { AudioRecorderControls } from "./audio-recorder-controls";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface AudioTrack {
  id: string;
  trackOrder: number;
  originalName: string | null;
  sourceLabel: string | null;
}

function xhrUpload(
  iId: string,
  blob: Blob,
  name: string,
  trackOrder?: number,
  sourceLabel?: string,
  onProgress?: (pct: number) => void,
) {
  const t = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
  const tk = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const fd = new FormData();
  fd.append("file", blob, name);
  const qs = trackOrder ? `?trackOrder=${trackOrder}&sourceLabel=${encodeURIComponent(sourceLabel ?? "")}` : "";
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("POST", `${API_BASE}/org-intelligence/interviews/${iId}/upload-audio${qs}`);
    if (t) x.setRequestHeader(TENANT_HEADER, t);
    if (tk) x.setRequestHeader("Authorization", `Bearer ${tk}`);
    if (onProgress) {
      x.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    x.addEventListener("load", () => (x.status < 300 ? res() : rej()));
    x.addEventListener("error", rej);
    x.send(fd);
  });
}

interface Props {
  interviewId: string;
  hasAudio: boolean;
  tracks?: AudioTrack[];
  onAudioUploaded: () => void;
}

const SOURCE_OPTIONS = ["iPhone", "MacBook", "Grabadora externa", "Otro"];

export function InterviewAudioStep({ interviewId: iId, hasAudio, tracks = [], onAudioUploaded }: Props) {
  const { state, start, pause, resume, stop, reset } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showUpload, setShowUpload] = useState(!hasAudio);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  // Pending files before upload
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [source1, setSource1] = useState("iPhone");
  const [source2, setSource2] = useState("MacBook");

  // Auto-detect source from filename
  const detectSource = (name: string): string => {
    const lower = name.toLowerCase();
    if (lower.includes("iphone") || lower.includes("ios")) return "iPhone";
    if (lower.includes("mac") || lower.includes("macbook")) return "MacBook";
    return "Otro";
  };

  const handleUpload = async () => {
    if (!file1 && !file2) return;
    setUploading(true);
    setProgress(0);

    try {
      if (file1) {
        await xhrUpload(iId, file1, file1.name, 1, source1, setProgress);
      }
      if (file2) {
        setProgress(0);
        await xhrUpload(iId, file2, file2.name, 2, source2, setProgress);
      }
      toast.success(file2 ? "2 audios subidos." : "Audio subido.");
      setFile1(null);
      setFile2(null);
      setShowUpload(false);
      onAudioUploaded();
    } catch {
      toast.error("Error al subir audio.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const doRecordUpload = async (blob: Blob, name: string) => {
    setUploading(true);
    try {
      await xhrUpload(iId, blob, name, 1, "Grabación browser");
      toast.success("Audio subido.");
      reset();
      setShowUpload(false);
      onAudioUploaded();
    } catch {
      toast.error("No se pudo subir el audio.");
    } finally {
      setUploading(false);
    }
  };

  if (hasAudio && !showUpload) {
    return (
      <div className="space-y-2">
        {tracks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {tracks.map((t) => (
              <span key={t.id} className="text-xs text-muted-foreground">
                Track {t.trackOrder}: {t.originalName} ({t.sourceLabel ?? "Sin fuente"})
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {tracks.length > 0 ? "Reemplazar audios" : "Reemplazar audio"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasAudio && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Al subir nuevo audio se reemplazará el actual y se deberá reprocesar la entrevista.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(false)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grabar audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <AudioRecorderControls
              status={state.status}
              onStart={() => start()}
              onPause={pause}
              onResume={resume}
              onStop={stop}
              onReset={reset}
              disabled={uploading}
            />
            {state.status === "recording" && (
              <p className="text-xs text-muted-foreground">{state.duration}s grabando...</p>
            )}
            {state.status === "stopped" && state.audioBlob && (
              <button
                type="button"
                onClick={() => doRecordUpload(state.audioBlob!, "recording.webm")}
                disabled={uploading}
                className="text-sm text-primary underline disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Subir grabación"}
              </button>
            )}
            {state.error && <p className="text-xs text-red-500">{state.error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subir archivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Track 1 */}
            <div className="space-y-1.5">
              {file1 ? (
                <div className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                  <span className="truncate">{file1.name}</span>
                  <div className="flex items-center gap-2">
                    <Select value={source1} onValueChange={setSource1}>
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={() => setFile1(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => ref1.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref1.current?.click(); }}
                  className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50"
                >
                  Track 1 — clic para seleccionar
                </div>
              )}
              <input
                ref={ref1}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile1(f);
                    setSource1(detectSource(f.name));
                  }
                  if (ref1.current) ref1.current.value = "";
                }}
              />
            </div>

            {/* Track 2 (optional) */}
            <div className="space-y-1.5">
              {file2 ? (
                <div className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                  <span className="truncate">{file2.name}</span>
                  <div className="flex items-center gap-2">
                    <Select value={source2} onValueChange={setSource2}>
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button type="button" onClick={() => setFile2(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                  </div>
                </div>
              ) : (
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => ref2.current?.click()}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref2.current?.click(); }}
                  className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 text-xs text-muted-foreground/60 transition-colors hover:border-muted-foreground/40"
                >
                  Track 2 (opcional) — mejora la transcripción
                </div>
              )}
              <input
                ref={ref2}
                type="file"
                accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile2(f);
                    setSource2(detectSource(f.name));
                  }
                  if (ref2.current) ref2.current.value = "";
                }}
              />
            </div>

            {(file1 || file2) && (
              <div className="space-y-1">
                <Button
                  onClick={handleUpload}
                  disabled={uploading || (!file1 && !file2)}
                  size="sm"
                  className="w-full"
                >
                  {uploading ? `Subiendo... ${progress}%` : `Subir ${file2 ? "2 archivos" : "archivo"}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update interview detail page to pass tracks**

In `apps/web/app/(dashboard)/org-intelligence/projects/[id]/interviews/[interviewId]/page.tsx`, find where `InterviewAudioStep` is used (around line 717) and add the `tracks` prop:

```tsx
<InterviewAudioStep
  interviewId={interviewId}
  hasAudio={!!interview.audioS3Key}
  tracks={interview.audioTracks ?? []}
  onAudioUploaded={fetchInterview}
/>
```

Make sure the `Interview` interface in the page includes `audioTracks`:

```typescript
audioTracks?: { id: string; trackOrder: number; originalName: string | null; sourceLabel: string | null }[];
```

Update the API response by adding `audioTracks` to the interview include/select in the backend `findOne` query if not already included.

- [ ] **Step 3: Add MERGE_REVIEW handling in the pipeline status UI**

Find where `showProcess` is computed and add `MERGE_REVIEW` as a state that shows the process button:

```typescript
const showProcess =
  (interview.processingStatus === "UPLOADED" ||
    interview.processingStatus === "MERGE_REVIEW" ||
    (interview.audioS3Key && interview.processingStatus === "PENDING")) &&
  !isProcessing;
```

When `MERGE_REVIEW`, the process button should say "Continuar procesamiento" and call process with `fromStep=TRANSCRIBING`:

```typescript
const handleProcess = async () => {
  setProcessing(true);
  try {
    const fromStep = interview.processingStatus === "MERGE_REVIEW" ? "TRANSCRIBING" : undefined;
    await api.post(
      `/org-intelligence/interviews/${interviewId}/process`,
      { fromStep },
      { headers: { [TENANT_HEADER]: tenantId } },
    );
  } catch { /* ... */ }
};
```

Update the button label:

```tsx
<Button onClick={handleProcess} disabled={processing}>
  {processing
    ? "Iniciando..."
    : interview.processingStatus === "MERGE_REVIEW"
      ? "Continuar procesamiento"
      : "Procesar"}
</Button>
```

When in `MERGE_REVIEW`, show the existing audio player so the user can listen to the merged result before continuing.

- [ ] **Step 4: Commit**

```bash
git add apps/web/ apps/api/src/modules/org-intelligence/ && git commit -m "feat: multi-track upload UI with merge review"
```

---

### Task 7: Lint and Verify

- [ ] **Step 1: Run lint**

```bash
pnpm lint
```

Fix any errors.

- [ ] **Step 2: Build API**

```bash
cd apps/api && npx nest build
```

- [ ] **Step 3: Build shared**

```bash
cd packages/shared && pnpm build
```

- [ ] **Step 4: Final commit if needed**

```bash
git add -A && git commit -m "fix: lint and build fixes for multi-audio"
```
