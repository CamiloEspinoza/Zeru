import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateStatusConfigDto,
  UpdateStatusConfigDto,
  ReorderStatusesDto,
} from '../dto';

@Injectable()
export class ProjectStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.taskStatusConfig.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateStatusConfigDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const maxOrder = await client.taskStatusConfig.aggregate({
      where: { projectId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return client.taskStatusConfig.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        color: dto.color,
        category: dto.category,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        projectId,
        tenantId,
      },
    });
  }

  async update(
    tenantId: string,
    projectId: string,
    statusId: string,
    dto: UpdateStatusConfigDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const status = await client.taskStatusConfig.findFirst({
      where: { id: statusId, projectId, deletedAt: null },
    });
    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }

    return client.taskStatusConfig.update({
      where: { id: statusId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });
  }

  async remove(tenantId: string, projectId: string, statusId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const status = await client.taskStatusConfig.findFirst({
      where: { id: statusId, projectId, deletedAt: null },
    });
    if (!status) {
      throw new NotFoundException('Estado no encontrado');
    }

    // Check if any tasks use this status
    const taskCount = await client.task.count({
      where: { statusId, deletedAt: null },
    });
    if (taskCount > 0) {
      throw new BadRequestException(
        `No se puede eliminar el estado porque tiene ${taskCount} tarea(s) asociada(s)`,
      );
    }

    await client.taskStatusConfig.update({
      where: { id: statusId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Estado eliminado' };
  }

  async reorder(
    tenantId: string,
    projectId: string,
    dto: ReorderStatusesDto,
  ) {
    await this.prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < dto.statusIds.length; i++) {
        await tx.taskStatusConfig.updateMany({
          where: {
            id: dto.statusIds[i],
            projectId,
            tenantId,
          },
          data: { sortOrder: i },
        });
      }
    });

    return this.findAll(tenantId, projectId);
  }
}
