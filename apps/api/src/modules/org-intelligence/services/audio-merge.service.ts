import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';

const execFile = promisify(execFileCb);

@Injectable()
export class AudioMergeService {
  private readonly logger = new Logger(AudioMergeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

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
      throw new NotFoundException(
        `Se necesitan al menos 2 pistas de audio para la entrevista ${interviewId}, se encontraron ${tracks.length}`,
      );
    }

    const track1 = tracks.find((t) => t.trackOrder === 1);
    const track2 = tracks.find((t) => t.trackOrder === 2);

    if (!track1 || !track2) {
      throw new NotFoundException(
        `No se encontraron las pistas 1 y 2 para la entrevista ${interviewId}`,
      );
    }

    const tmpDir = await mkdtemp(join(tmpdir(), 'audio-merge-'));

    try {
      // 1. Download both tracks from S3
      this.logger.log(`Descargando pistas de audio para entrevista ${interviewId}`);
      const [dl1, dl2] = await Promise.all([
        this.s3.download(tenantId, track1.s3Key),
        this.s3.download(tenantId, track2.s3Key),
      ]);

      const raw1 = join(tmpDir, 'raw1.audio');
      const raw2 = join(tmpDir, 'raw2.audio');
      const norm1 = join(tmpDir, 'norm1.wav');
      const norm2 = join(tmpDir, 'norm2.wav');
      const merged = join(tmpDir, 'merged.wav');

      // Write raw downloads to disk
      const { writeFile } = await import('fs/promises');
      await Promise.all([
        writeFile(raw1, dl1.buffer),
        writeFile(raw2, dl2.buffer),
      ]);

      // 2. Normalize levels with ffmpeg
      this.logger.log('Normalizando niveles de audio');
      await Promise.all([
        this.normalize(raw1, norm1),
        this.normalize(raw2, norm2),
      ]);

      // 3. Detect offset between the two recordings
      this.logger.log('Detectando offset entre pistas');
      const offsetMs = await this.detectOffset(norm1, norm2, tmpDir);
      this.logger.log(`Offset detectado: ${offsetMs}ms`);

      // 4. Merge into stereo WAV
      this.logger.log('Mezclando en estéreo');
      await this.mergeStereo(norm1, norm2, merged, offsetMs);

      // 5. Upload merged file to S3
      const mergedBuffer = await readFile(merged);
      const mergedS3Key = `tenants/${tenantId}/interviews/${interviewId}/audio/merged.wav`;

      await this.s3.upload(tenantId, mergedS3Key, mergedBuffer, 'audio/wav');

      // Update interview record
      await client.interview.update({
        where: { id: interviewId },
        data: { audioS3Key: mergedS3Key },
      });

      this.logger.log(`Audio mezclado subido a ${mergedS3Key}`);
      return { mergedS3Key, offsetMs };
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch((err) =>
        this.logger.warn(`No se pudo limpiar directorio temporal: ${err.message}`),
      );
    }
  }

  private async normalize(input: string, output: string): Promise<void> {
    await execFile('ffmpeg', [
      '-i', input,
      '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
      '-ar', '16000',
      '-ac', '1',
      '-y', output,
    ]);
  }

  /**
   * Detect the time offset between two audio files.
   * Fast-path: detect a loud clap/peak in the first 60s.
   * Fallback: cross-correlation on first 3 minutes downsampled to 1kHz.
   */
  private async detectOffset(
    file1: string,
    file2: string,
    tmpDir: string,
  ): Promise<number> {
    // Try fast-path: clap detection
    const clapOffset = await this.detectClapOffset(file1, file2, tmpDir);
    if (clapOffset !== null) {
      this.logger.log('Offset detectado por palmada (fast-path)');
      return clapOffset;
    }

    // Fallback: cross-correlation
    this.logger.log('Usando cross-correlation como fallback');
    return this.detectCrossCorrelationOffset(file1, file2, tmpDir);
  }

  /**
   * Look for a loud peak (clap) in the first 60s of each audio.
   * Returns offset in ms if both have a clear peak, null otherwise.
   */
  private async detectClapOffset(
    file1: string,
    file2: string,
    tmpDir: string,
  ): Promise<number | null> {
    const pcm1 = join(tmpDir, 'clap1.pcm');
    const pcm2 = join(tmpDir, 'clap2.pcm');

    // Extract first 60s as raw PCM float32 at 16kHz
    await Promise.all([
      execFile('ffmpeg', [
        '-i', file1, '-t', '60',
        '-f', 'f32le', '-ar', '16000', '-ac', '1',
        '-y', pcm1,
      ]),
      execFile('ffmpeg', [
        '-i', file2, '-t', '60',
        '-f', 'f32le', '-ar', '16000', '-ac', '1',
        '-y', pcm2,
      ]),
    ]);

    const [buf1, buf2] = await Promise.all([readFile(pcm1), readFile(pcm2)]);
    const samples1 = new Float32Array(buf1.buffer, buf1.byteOffset, buf1.byteLength / 4);
    const samples2 = new Float32Array(buf2.buffer, buf2.byteOffset, buf2.byteLength / 4);

    const peak1 = this.findPeak(samples1, 16000);
    const peak2 = this.findPeak(samples2, 16000);

    if (peak1 === null || peak2 === null) return null;

    // Return offset in ms: positive means track2 starts earlier
    return Math.round(peak1 - peak2);
  }

  /**
   * Find a loud peak in samples. Returns its time in ms, or null if no clear peak.
   * A "clear peak" is defined as a sample whose absolute value is >6x the average.
   */
  private findPeak(samples: Float32Array, sampleRate: number): number | null {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += Math.abs(samples[i]);
    }
    const avg = sum / samples.length;
    if (avg === 0) return null;

    const threshold = avg * 6;
    let maxVal = 0;
    let maxIdx = -1;

    for (let i = 0; i < samples.length; i++) {
      const absVal = Math.abs(samples[i]);
      if (absVal > threshold && absVal > maxVal) {
        maxVal = absVal;
        maxIdx = i;
      }
    }

    if (maxIdx === -1) return null;
    return (maxIdx / sampleRate) * 1000;
  }

  /**
   * Cross-correlation on first 3 minutes downsampled to 1kHz.
   * Search ±60s range for the lag with maximum correlation.
   */
  private async detectCrossCorrelationOffset(
    file1: string,
    file2: string,
    tmpDir: string,
  ): Promise<number> {
    const pcm1 = join(tmpDir, 'xcorr1.pcm');
    const pcm2 = join(tmpDir, 'xcorr2.pcm');

    // Extract first 3 minutes at 8kHz raw PCM
    await Promise.all([
      execFile('ffmpeg', [
        '-i', file1, '-t', '180',
        '-f', 'f32le', '-ar', '8000', '-ac', '1',
        '-y', pcm1,
      ]),
      execFile('ffmpeg', [
        '-i', file2, '-t', '180',
        '-f', 'f32le', '-ar', '8000', '-ac', '1',
        '-y', pcm2,
      ]),
    ]);

    const [buf1, buf2] = await Promise.all([readFile(pcm1), readFile(pcm2)]);
    const raw1 = new Float32Array(buf1.buffer, buf1.byteOffset, buf1.byteLength / 4);
    const raw2 = new Float32Array(buf2.buffer, buf2.byteOffset, buf2.byteLength / 4);

    // Downsample from 8kHz to 1kHz (take every 8th sample)
    const ds1 = this.downsample(raw1, 8);
    const ds2 = this.downsample(raw2, 8);

    // Search ±60s at 1kHz = ±60000 samples
    const maxLag = 60000;
    let bestLag = 0;
    let bestCorr = -Infinity;

    for (let lag = -maxLag; lag <= maxLag; lag++) {
      let corr = 0;
      let count = 0;

      for (let i = 0; i < ds1.length; i++) {
        const j = i + lag;
        if (j >= 0 && j < ds2.length) {
          corr += ds1[i] * ds2[j];
          count++;
        }
      }

      if (count > 0) {
        corr /= count;
      }

      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }

    // lag is in 1kHz samples, convert to ms (1 sample = 1ms at 1kHz)
    return bestLag;
  }

  private downsample(samples: Float32Array, factor: number): Float32Array {
    const result = new Float32Array(Math.floor(samples.length / factor));
    for (let i = 0; i < result.length; i++) {
      result[i] = samples[i * factor];
    }
    return result;
  }

  /**
   * Merge two mono WAV files into a stereo WAV with offset applied.
   * Track1 = left channel, Track2 = right channel.
   */
  private async mergeStereo(
    track1: string,
    track2: string,
    output: string,
    offsetMs: number,
  ): Promise<void> {
    const offsetSec = Math.abs(offsetMs) / 1000;

    // If offset is positive, track1's peak comes after track2's → delay track2
    // If offset is negative, track1 starts later → delay track1
    const args: string[] = [];

    if (offsetMs >= 0) {
      args.push(
        '-i', track1,
        '-itsoffset', offsetSec.toFixed(3),
        '-i', track2,
      );
    } else {
      args.push(
        '-itsoffset', offsetSec.toFixed(3),
        '-i', track1,
        '-i', track2,
      );
    }

    args.push(
      '-filter_complex',
      '[0:a][1:a]join=inputs=2:channel_layout=stereo:map=0.0-FL|1.0-FR[a]',
      '-map', '[a]',
      '-ar', '16000',
      '-y', output,
    );

    await execFile('ffmpeg', args);
  }
}
