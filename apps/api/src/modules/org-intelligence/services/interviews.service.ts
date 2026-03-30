import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { execFile } from 'node:child_process';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import type {
  CreateInterviewDto,
  UpdateInterviewDto,
  ListInterviewsDto,
  UpdateSpeakerDto,
} from '../dto';

const ALLOWED_AUDIO_MIMETYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
];

@Injectable()
export class InterviewsService {
  private readonly logger = new Logger(InterviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(tenantId: string, dto: CreateInterviewDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.interview.create({
      data: {
        projectId: dto.projectId,
        title: dto.title,
        interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : undefined,
        ...(dto.speakers && dto.speakers.length > 0
          ? {
              speakers: {
                createMany: {
                  data: dto.speakers.map((s) => ({
                    speakerLabel: s.speakerLabel,
                    name: s.name,
                    role: s.role,
                    department: s.department,
                    isInterviewer: s.isInterviewer,
                  })),
                },
              },
            }
          : {}),
      },
      include: {
        speakers: true,
      },
    });
  }

  async findAll(tenantId: string, dto: ListInterviewsDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where = {
      deletedAt: null,
      projectId: dto.projectId,
      ...(dto.processingStatus ? { processingStatus: dto.processingStatus } : {}),
    };

    const [data, total] = await Promise.all([
      client.interview.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          speakers: true,
          _count: {
            select: { chunks: true },
          },
        },
      }),
      client.interview.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: dto.page,
        perPage: dto.perPage,
        totalPages: Math.ceil(total / dto.perPage),
      },
    };
  }

  async findOne(tenantId: string, id: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const interview = await client.interview.findFirst({
      where: { id, deletedAt: null },
      include: {
        speakers: true,
        _count: {
          select: { chunks: true },
        },
      },
    });

    if (!interview) {
      throw new NotFoundException(`Entrevista con id ${id} no encontrada`);
    }

    return interview;
  }

  async update(tenantId: string, id: string, dto: UpdateInterviewDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.interview.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.interviewDate !== undefined && {
          interviewDate: dto.interviewDate ? new Date(dto.interviewDate) : null,
        }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.interview.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadAudio(tenantId: string, id: string, file: Express.Multer.File) {
    if (!ALLOWED_AUDIO_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${ALLOWED_AUDIO_MIMETYPES.join(', ')}`,
      );
    }

    await this.findOne(tenantId, id);

    // Normalize audio with ffmpeg to fix headers (duration, seek support).
    // Streaming-generated MP3s (e.g. ElevenLabs) often have incorrect Xing
    // headers that make browsers report wrong duration and break seeking.
    const normalized = await this.normalizeAudio(file.buffer, file.originalname);

    const outName = file.originalname.replace(/\.[^.]+$/, '.mp3');
    const key = `tenants/${tenantId}/interviews/${id}/audio/${outName}`;
    await this.s3.upload(tenantId, key, normalized, 'audio/mpeg');

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.interview.update({
      where: { id },
      data: {
        audioS3Key: key,
        audioMimeType: 'audio/mpeg',
        processingStatus: 'UPLOADED',
      },
    });
  }

  /**
   * Re-encode audio through ffmpeg to produce a well-formed MP3 with correct
   * duration headers. Falls back to the original buffer if ffmpeg is unavailable.
   */
  private async normalizeAudio(buffer: Buffer, filename: string): Promise<Buffer> {
    const uid = randomUUID();
    const inputPath = join(tmpdir(), `zeru-audio-in-${uid}-${filename}`);
    const outputPath = join(tmpdir(), `zeru-audio-out-${uid}.mp3`);

    try {
      await writeFile(inputPath, buffer);

      await new Promise<void>((resolve, reject) => {
        execFile(
          'ffmpeg',
          ['-i', inputPath, '-codec:a', 'libmp3lame', '-b:a', '128k', '-y', outputPath],
          { timeout: 120_000 },
          (err) => (err ? reject(err) : resolve()),
        );
      });

      const result = await readFile(outputPath);
      this.logger.log(`Audio normalized: ${filename} (${buffer.length} → ${result.length} bytes)`);
      return result;
    } catch (err) {
      this.logger.warn(
        `ffmpeg normalization failed, using original file: ${(err as Error).message}`,
      );
      return buffer;
    } finally {
      await unlink(inputPath).catch(() => {});
      await unlink(outputPath).catch(() => {});
    }
  }

  async updateSpeakers(tenantId: string, id: string, dto: UpdateSpeakerDto) {
    // Verify interview belongs to tenant
    await this.findOne(tenantId, id);

    // Use base prisma client (not tenant-aware) because InterviewSpeaker
    // doesn't have tenantId column — tenant isolation is guaranteed by
    // the findOne check above (interview.tenantId === tenantId)
    return this.prisma.$transaction(async (tx) => {
      await tx.interviewSpeaker.deleteMany({
        where: { interviewId: id },
      });

      // For each speaker, use explicit personEntityId if provided, otherwise try to match by name
      const speakersData = await Promise.all(
        dto.speakers.map(async (s) => {
          let personEntityId: string | null = s.personEntityId ?? null;

          if (!personEntityId && s.name) {
            try {
              const person = await tx.personProfile.findFirst({
                where: {
                  tenantId,
                  deletedAt: null,
                  name: { contains: s.name, mode: 'insensitive' },
                },
                select: { id: true },
              });
              personEntityId = person?.id ?? null;
            } catch {
              // Ignore matching errors
            }
          }

          return {
            interviewId: id,
            speakerLabel: s.speakerLabel,
            name: s.name,
            role: s.role,
            department: s.department,
            isInterviewer: s.isInterviewer ?? false,
            personEntityId,
          };
        }),
      );

      await tx.interviewSpeaker.createMany({
        data: speakersData,
      });

      return tx.interview.findFirst({
        where: { id },
        include: { speakers: true },
      });
    });
  }

  async getTranscription(tenantId: string, id: string) {
    const interview = await this.findOne(tenantId, id);

    return {
      text: interview.transcriptionText,
      json: interview.transcriptionJson,
      status: interview.transcriptionStatus,
      provider: interview.transcriptionProvider,
    };
  }

  async getStatus(tenantId: string, id: string) {
    const interview = await this.findOne(tenantId, id);

    return {
      processingStatus: interview.processingStatus,
      processingError: interview.processingError,
      transcriptionStatus: interview.transcriptionStatus,
      processingLog: interview.processingLog ?? [],
    };
  }
}
