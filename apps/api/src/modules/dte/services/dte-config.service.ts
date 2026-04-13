import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { CreateDteConfigSchema } from '@zeru/shared';

@Injectable()
export class DteConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async get(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const config = await db.dteConfig.findUnique({ where: { tenantId } });
    if (!config) {
      throw new NotFoundException(
        'Configuración DTE no encontrada. Configure los datos del emisor primero.',
      );
    }
    return config;
  }

  async getOptional(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteConfig.findUnique({ where: { tenantId } });
  }

  async upsert(tenantId: string, data: CreateDteConfigSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return db.dteConfig.upsert({
      where: { tenantId },
      create: {
        ...data,
        resolutionDate: new Date(data.resolutionDate),
        tenantId,
      },
      update: {
        ...data,
        resolutionDate: new Date(data.resolutionDate),
      },
    });
  }
}
