import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateLabelDto, UpdateLabelDto } from '../dto';

@Injectable()
export class ProjectLabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.label.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(tenantId: string, projectId: string, dto: CreateLabelDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const maxOrder = await client.label.aggregate({
      where: { projectId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return client.label.create({
      data: {
        name: dto.name,
        color: dto.color,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
        projectId,
        tenantId,
      },
    });
  }

  async update(
    tenantId: string,
    projectId: string,
    labelId: string,
    dto: UpdateLabelDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const label = await client.label.findFirst({
      where: { id: labelId, projectId, deletedAt: null },
    });
    if (!label) {
      throw new NotFoundException('Etiqueta no encontrada');
    }

    return client.label.update({
      where: { id: labelId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
    });
  }

  async remove(tenantId: string, projectId: string, labelId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const label = await client.label.findFirst({
      where: { id: labelId, projectId, deletedAt: null },
    });
    if (!label) {
      throw new NotFoundException('Etiqueta no encontrada');
    }

    await this.prisma.$transaction(async (tx: any) => {
      // Cascade: remove task-label associations
      await tx.taskLabel.deleteMany({
        where: { labelId, tenantId },
      });

      await tx.label.update({
        where: { id: labelId },
        data: { deletedAt: new Date() },
      });
    });

    return { message: 'Etiqueta eliminada' };
  }
}
