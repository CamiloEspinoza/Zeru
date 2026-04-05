import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeRut } from '@zeru/shared';
import type { CreateLegalEntitySchema, UpdateLegalEntitySchema } from '@zeru/shared';

@Injectable()
export class LegalEntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.legalEntity.findMany({
      orderBy: { legalName: 'asc' },
      include: { _count: { select: { labOrigins: true } } },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({
      where: { id },
      include: {
        contacts: { where: { isActive: true } },
        bankAccounts: { where: { isActive: true } },
        labOrigins: { where: { isActive: true }, select: { id: true, code: true, name: true, category: true } },
        billingAgreements: { where: { isActive: true }, select: { id: true, code: true, name: true, status: true } },
      },
    });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    return entity;
  }

  async create(tenantId: string, data: CreateLegalEntitySchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.create({
      data: {
        ...data,
        rut: normalizeRut(data.rut),
        isClient: data.isClient ?? false,
        isSupplier: data.isSupplier ?? false,
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'legal-entity',
      entityId: entity.id,
      action: 'create',
    });
    return entity;
  }

  async update(id: string, tenantId: string, data: UpdateLegalEntitySchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    const updated = await client.legalEntity.update({
      where: { id },
      data: {
        ...data,
        ...(data.rut && { rut: normalizeRut(data.rut) }),
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'legal-entity',
      entityId: id,
      action: 'update',
    });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const entity = await client.legalEntity.findUnique({ where: { id } });
    if (!entity) throw new NotFoundException(`LegalEntity ${id} not found`);
    await client.legalEntity.delete({ where: { id } });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'legal-entity',
      entityId: id,
      action: 'delete',
    });
  }
}
