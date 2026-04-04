import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLabOriginSchema, UpdateLabOriginSchema } from '@zeru/shared';

@Injectable()
export class LabOriginsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.labOrigin.findMany({
      orderBy: { name: 'asc' },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true, pricing: true } },
      },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({
      where: { id },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: { where: { isActive: true }, select: { id: true, code: true, name: true, category: true } },
        pricing: { where: { isActive: true }, orderBy: { billingConcept: 'asc' } },
      },
    });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    return origin;
  }

  async create(tenantId: string, data: CreateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.labOrigin.create({
      data: {
        ...data,
        contractDate: data.contractDate ? new Date(data.contractDate) : undefined,
      },
    });
  }

  async update(id: string, tenantId: string, data: UpdateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    return client.labOrigin.update({
      where: { id },
      data: {
        ...data,
        ...(data.contractDate !== undefined && {
          contractDate: data.contractDate ? new Date(data.contractDate) : null,
        }),
      },
    });
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    await client.labOrigin.delete({ where: { id } });
  }
}
