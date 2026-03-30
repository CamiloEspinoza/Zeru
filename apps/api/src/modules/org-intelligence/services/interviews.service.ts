import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
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

    const key = `tenants/${tenantId}/interviews/${id}/audio/${file.originalname}`;
    await this.s3.upload(tenantId, key, file.buffer, file.mimetype);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.interview.update({
      where: { id },
      data: {
        audioS3Key: key,
        audioMimeType: file.mimetype,
        processingStatus: 'UPLOADED',
      },
    });
  }

  async updateSpeakers(tenantId: string, id: string, dto: UpdateSpeakerDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.$transaction(async (tx) => {
      await tx.interviewSpeaker.deleteMany({
        where: { interviewId: id },
      });

      // For each speaker, try to match to an existing PersonProfile
      const speakersData = await Promise.all(
        dto.speakers.map(async (s) => {
          let personEntityId: string | null = null;

          if (s.name) {
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
              // Ignore matching errors — speaker will be created without link
            }
          }

          return {
            interviewId: id,
            speakerLabel: s.speakerLabel,
            name: s.name,
            role: s.role,
            department: s.department,
            isInterviewer: s.isInterviewer,
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
    };
  }
}
