import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateFiscalPeriodSchema } from '@zeru/shared';

@Injectable()
export class FiscalPeriodsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    return client.fiscalPeriod.findMany({
      orderBy: { startDate: 'desc' },
    });
  }

  async create(tenantId: string, data: CreateFiscalPeriodSchema) {
    const client = this.prisma.forTenant(tenantId) as any;

    return client.fiscalPeriod.create({
      data: {
        name: data.name,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
      },
    });
  }

  async close(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const period = await client.fiscalPeriod.findUnique({
      where: { id },
    });

    if (!period) {
      throw new NotFoundException(`Fiscal period with id ${id} not found`);
    }

    return client.fiscalPeriod.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
}
