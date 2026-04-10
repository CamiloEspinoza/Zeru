import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateImprovementDto,
  UpdateImprovementDto,
} from '../dto';

@Injectable()
export class OrgImprovementsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateImprovementDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.improvement.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        effort: dto.effort,
        impact: dto.impact,
        priority: dto.priority,
        projectId: dto.projectId,
        problemId: dto.problemId,
      },
      include: { problem: true },
    });
  }

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.improvement.findMany({
      where: { projectId, deletedAt: null },
      include: { problem: true },
      orderBy: { priority: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const improvement = await client.improvement.findFirst({
      where: { id, deletedAt: null },
      include: {
        problem: {
          include: { affectedEntities: { include: { entity: true } } },
        },
      },
    });

    if (!improvement) {
      throw new NotFoundException('Mejora no encontrada');
    }

    return improvement;
  }

  async update(tenantId: string, id: string, dto: UpdateImprovementDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.improvement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.effort !== undefined && { effort: dto.effort }),
        ...(dto.impact !== undefined && { impact: dto.impact }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { problem: true },
    });
  }
}
