import {
  Controller,
  Get,
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

@Controller('org-intelligence/problems')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProblemsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
    @Query('severity') severity?: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.problem.findMany({
      where: {
        projectId,
        deletedAt: null,
        ...(severity && { severity: severity as never }),
      },
      include: {
        affectedEntities: { include: { entity: true } },
        improvements: true,
      },
      orderBy: [{ severity: 'asc' }, { confidence: 'desc' }],
    });
  }

  @Get(':id')
  async findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const problem = await client.problem.findFirst({
      where: { id, deletedAt: null },
      include: {
        affectedEntities: { include: { entity: true } },
        improvements: true,
      },
    });

    if (!problem) {
      throw new NotFoundException('Problema no encontrado');
    }

    return problem;
  }
}
