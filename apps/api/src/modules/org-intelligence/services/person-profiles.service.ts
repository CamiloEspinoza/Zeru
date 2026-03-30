import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import type {
  CreatePersonProfileDto,
  UpdatePersonProfileDto,
  ListPersonProfilesDto,
} from '../dto';

const ALLOWED_IMAGE_MIMETYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

@Injectable()
export class PersonProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(tenantId: string, dto: CreatePersonProfileDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.create({
      data: {
        name: dto.name,
        role: dto.role,
        department: dto.department,
        email: dto.email,
        phone: dto.phone,
        notes: dto.notes,
      },
    });
  }

  async findAll(tenantId: string, dto: ListPersonProfilesDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (dto.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { role: { contains: dto.search, mode: 'insensitive' } },
        { department: { contains: dto.search, mode: 'insensitive' } },
        { email: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      client.personProfile.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
      }),
      client.personProfile.count({ where }),
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

    const profile = await client.personProfile.findFirst({
      where: { id, deletedAt: null },
    });

    if (!profile) {
      throw new NotFoundException(`Perfil de persona con id ${id} no encontrado`);
    }

    return profile;
  }

  async update(tenantId: string, id: string, dto: UpdatePersonProfileDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.department !== undefined && { department: dto.department }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadAvatar(tenantId: string, id: string, file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_MIMETYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Tipos permitidos: ${ALLOWED_IMAGE_MIMETYPES.join(', ')}`,
      );
    }

    await this.findOne(tenantId, id);

    const ext = file.originalname.split('.').pop() ?? 'jpg';
    const key = `tenants/${tenantId}/persons/${id}/avatar.${ext}`;
    await this.s3.upload(tenantId, key, file.buffer, file.mimetype);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.personProfile.update({
      where: { id },
      data: { avatarS3Key: key },
    });
  }

  async getAvatarUrl(tenantId: string, id: string) {
    const profile = await this.findOne(tenantId, id);

    if (!profile.avatarS3Key) {
      return { url: null };
    }

    const url = await this.s3.getPresignedUrl(tenantId, profile.avatarS3Key, 3600);
    return { url };
  }
}
