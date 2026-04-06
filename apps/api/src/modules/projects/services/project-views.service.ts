import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateViewDto, UpdateViewDto } from '../dto';

@Injectable()
export class ProjectViewsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.taskView.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreateViewDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const maxOrder = await client.taskView.aggregate({
      where: { projectId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return client.taskView.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: dto.config ?? {},
        filters: dto.filters ?? {},
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        projectId,
        createdById: userId,
        tenantId,
      },
    });
  }

  async update(
    tenantId: string,
    projectId: string,
    viewId: string,
    dto: UpdateViewDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const view = await client.taskView.findFirst({
      where: { id: viewId, projectId, deletedAt: null },
    });
    if (!view) {
      throw new NotFoundException('Vista no encontrada');
    }

    return client.taskView.update({
      where: { id: viewId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.config !== undefined && { config: dto.config }),
        ...(dto.filters !== undefined && { filters: dto.filters }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(tenantId: string, projectId: string, viewId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const view = await client.taskView.findFirst({
      where: { id: viewId, projectId, deletedAt: null },
    });
    if (!view) {
      throw new NotFoundException('Vista no encontrada');
    }

    await client.taskView.update({
      where: { id: viewId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Vista eliminada' };
  }
}
