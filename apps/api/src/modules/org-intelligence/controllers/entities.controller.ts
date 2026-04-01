import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('org-intelligence/entities')
@UseGuards(JwtAuthGuard, TenantGuard)
export class EntitiesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
    @Query('type') type?: string,
    @Query('page') page = '1',
    @Query('perPage') perPage = '20',
  ) {
    if (!projectId) {
      throw new BadRequestException('projectId es requerido');
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const perPageNum = Math.min(Math.max(parseInt(perPage, 10) || 20, 1), 100);
    const skip = (pageNum - 1) * perPageNum;

    const where = {
      projectId,
      validTo: null as Date | null,
      deletedAt: null as Date | null,
      ...(type && { type: type as never }),
    };

    const [items, total] = await Promise.all([
      client.orgEntity.findMany({
        where,
        skip,
        take: perPageNum,
        orderBy: { name: 'asc' },
        include: {
          relationsFrom: { select: { id: true } },
          relationsTo: { select: { id: true } },
          _count: {
            select: { relationsFrom: true, relationsTo: true },
          },
        },
      }),
      client.orgEntity.count({ where }),
    ]);

    return { data: items, meta: { total, page: pageNum, perPage: perPageNum } };
  }

  @Get(':id')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const entity = await client.orgEntity.findFirst({
      where: { id, deletedAt: null },
      include: {
        relationsFrom: { include: { toEntity: true } },
        relationsTo: { include: { fromEntity: true } },
        problemLinks: { include: { problem: true } },
      },
    });

    if (!entity) {
      throw new NotFoundException('Entidad no encontrada');
    }

    return entity;
  }

  @Post(':id/approve')
  async approve(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const entity = await client.orgEntity.findFirst({
      where: { id, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Entidad no encontrada');
    }

    return client.orgEntity.update({
      where: { id },
      data: { confidence: 1.0, status: 'ACTIVE' },
    });
  }

  @Post(':id/reject')
  async reject(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const entity = await client.orgEntity.findFirst({
      where: { id, deletedAt: null },
    });
    if (!entity) {
      throw new NotFoundException('Entidad no encontrada');
    }

    return client.orgEntity.update({
      where: { id },
      data: { status: 'DEPRECATED', deletedAt: new Date() },
    });
  }
}
