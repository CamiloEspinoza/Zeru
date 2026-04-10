import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateBillingConceptSchema, UpdateBillingConceptSchema } from '@zeru/shared';

@Injectable()
export class BillingConceptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.billingConcept.findMany({
      orderBy: { code: 'asc' },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const concept = await client.billingConcept.findUnique({ where: { id } });
    if (!concept) throw new NotFoundException(`BillingConcept ${id} not found`);
    return concept;
  }

  async create(tenantId: string, data: CreateBillingConceptSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const concept = await client.billingConcept.create({ data });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-concept',
      entityId: concept.id,
      action: 'create',
    });
    return concept;
  }

  async update(id: string, tenantId: string, data: UpdateBillingConceptSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const concept = await client.billingConcept.findUnique({ where: { id } });
    if (!concept) throw new NotFoundException(`BillingConcept ${id} not found`);
    const updated = await client.billingConcept.update({
      where: { id },
      data,
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-concept',
      entityId: id,
      action: 'update',
    });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const concept = await client.billingConcept.findUnique({ where: { id } });
    if (!concept) throw new NotFoundException(`BillingConcept ${id} not found`);
    await client.billingConcept.delete({ where: { id } });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-concept',
      entityId: id,
      action: 'delete',
    });
  }
}
