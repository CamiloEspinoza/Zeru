import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient, DteType, DteStatus, DteDirection } from '@prisma/client';

@Injectable()
export class DteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    filters?: {
      dteType?: DteType;
      status?: DteStatus;
      direction?: DteDirection;
      limit?: number;
      offset?: number;
    },
  ) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dte.findMany({
      where: {
        ...(filters?.dteType && { dteType: filters.dteType }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.direction && { direction: filters.direction }),
      },
      include: {
        items: true,
        references: true,
        logs: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  }

  async getById(tenantId: string, id: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dte.findUniqueOrThrow({
      where: { id },
      include: {
        items: true,
        references: true,
        globalDiscounts: true,
        logs: { orderBy: { createdAt: 'desc' } },
        exchanges: { include: { events: true } },
      },
    });
  }
}
