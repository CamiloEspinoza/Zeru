import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateProjectDto, UpdateProjectDto, ListProjectsDto } from '../dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateProjectDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.orgProject.create({
      data: {
        name: dto.name,
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        config: dto.config ?? undefined,
        createdById: userId,
      },
    });
  }

  async findAll(tenantId: string, dto: ListProjectsDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where = {
      deletedAt: null,
      ...(dto.status ? { status: dto.status } : {}),
    };

    const [data, total] = await Promise.all([
      client.orgProject.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          _count: {
            select: {
              interviews: true,
              orgEntities: true,
              problems: true,
            },
          },
        },
      }),
      client.orgProject.count({ where }),
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

    const project = await client.orgProject.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            interviews: true,
            orgEntities: true,
            problems: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException(`Proyecto con id ${id} no encontrado`);
    }

    return project;
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.orgProject.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.startDate !== undefined && {
          startDate: dto.startDate ? new Date(dto.startDate) : null,
        }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.config !== undefined && { config: dto.config }),
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.orgProject.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
