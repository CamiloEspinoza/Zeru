import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  NotFoundException,
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
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const pageNum = parseInt(page, 10);
    const perPageNum = parseInt(perPage, 10);
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
        },
      }),
      client.orgEntity.count({ where }),
    ]);

    return { items, total, page: pageNum, perPage: perPageNum };
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

    return client.orgEntity.update({
      where: { id },
      data: { status: 'DEPRECATED', deletedAt: new Date() },
    });
  }
}
