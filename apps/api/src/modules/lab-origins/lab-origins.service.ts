import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateLabOriginSchema, UpdateLabOriginSchema } from '@zeru/shared';

@Injectable()
export class LabOriginsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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
    const { contractDate, incorporationDate, agreementDate, lastAddendumDate, ...rest } = data;
    const origin = await client.labOrigin.create({
      data: {
        ...rest,
        contractDate: contractDate ? new Date(contractDate) : undefined,
        incorporationDate: incorporationDate ? new Date(incorporationDate) : undefined,
        agreementDate: agreementDate ? new Date(agreementDate) : undefined,
        lastAddendumDate: lastAddendumDate ? new Date(lastAddendumDate) : undefined,
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'lab-origin',
      entityId: origin.id,
      action: 'create',
    });
    return origin;
  }

  async update(id: string, tenantId: string, data: UpdateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    const { contractDate, incorporationDate, agreementDate, lastAddendumDate, ...rest } = data;
    const dateFields: Record<string, Date | null | undefined> = {};
    if (contractDate !== undefined) dateFields.contractDate = contractDate ? new Date(contractDate) : null;
    if (incorporationDate !== undefined) dateFields.incorporationDate = incorporationDate ? new Date(incorporationDate) : null;
    if (agreementDate !== undefined) dateFields.agreementDate = agreementDate ? new Date(agreementDate) : null;
    if (lastAddendumDate !== undefined) dateFields.lastAddendumDate = lastAddendumDate ? new Date(lastAddendumDate) : null;
    const updated = await client.labOrigin.update({
      where: { id },
      data: { ...rest, ...dateFields },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'lab-origin',
      entityId: id,
      action: 'update',
    });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    await client.labOrigin.delete({ where: { id } });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'lab-origin',
      entityId: id,
      action: 'delete',
    });
  }
}
