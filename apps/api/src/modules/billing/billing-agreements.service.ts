import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateBillingAgreementSchema,
  UpdateBillingAgreementSchema,
  CreateBillingAgreementLineSchema,
  CreateBillingContactSchema,
} from '@zeru/shared';

@Injectable()
export class BillingAgreementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.billingAgreement.findMany({
      orderBy: { code: 'asc' },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        _count: { select: { lines: true, contacts: true, labOrigins: true } },
      },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const agreement = await client.billingAgreement.findUnique({
      where: { id },
      include: {
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        lines: {
          where: { isActive: true },
          include: { billingConcept: true },
          orderBy: { createdAt: 'asc' },
        },
        contacts: { where: { isActive: true }, orderBy: { isPrimary: 'desc' } },
        labOrigins: {
          where: { isActive: true },
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    if (!agreement) throw new NotFoundException(`BillingAgreement ${id} not found`);
    return agreement;
  }

  async create(tenantId: string, data: CreateBillingAgreementSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const { contractDate, effectiveFrom, effectiveTo, ...rest } = data;
    const agreement = await client.billingAgreement.create({
      data: {
        ...rest,
        contractDate: contractDate ? new Date(contractDate) : undefined,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : undefined,
        effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-agreement',
      entityId: agreement.id,
      action: 'create',
    });
    return agreement;
  }

  async update(id: string, tenantId: string, data: UpdateBillingAgreementSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const agreement = await client.billingAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException(`BillingAgreement ${id} not found`);
    const { contractDate, effectiveFrom, effectiveTo, ...rest } = data;
    const dateFields: Record<string, Date | null | undefined> = {};
    if (contractDate !== undefined) dateFields.contractDate = contractDate ? new Date(contractDate) : null;
    if (effectiveFrom !== undefined) dateFields.effectiveFrom = effectiveFrom ? new Date(effectiveFrom) : null;
    if (effectiveTo !== undefined) dateFields.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    const updated = await client.billingAgreement.update({
      where: { id },
      data: { ...rest, ...dateFields },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-agreement',
      entityId: id,
      action: 'update',
    });
    return updated;
  }

  async delete(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const agreement = await client.billingAgreement.findUnique({ where: { id } });
    if (!agreement) throw new NotFoundException(`BillingAgreement ${id} not found`);
    await client.billingAgreement.delete({ where: { id } });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-agreement',
      entityId: id,
      action: 'delete',
    });
  }

  async addLine(agreementId: string, tenantId: string, data: CreateBillingAgreementLineSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const agreement = await client.billingAgreement.findUnique({ where: { id: agreementId } });
    if (!agreement) throw new NotFoundException(`BillingAgreement ${agreementId} not found`);
    const line = await client.billingAgreementLine.create({
      data: {
        ...data,
        billingAgreementId: agreementId,
        tenantId,
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-agreement',
      entityId: agreementId,
      action: 'update',
    });
    return line;
  }

  async addContact(agreementId: string, tenantId: string, data: CreateBillingContactSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const agreement = await client.billingAgreement.findUnique({ where: { id: agreementId } });
    if (!agreement) throw new NotFoundException(`BillingAgreement ${agreementId} not found`);
    const contact = await client.billingContact.create({
      data: {
        ...data,
        billingAgreementId: agreementId,
        tenantId,
      },
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'billing-agreement',
      entityId: agreementId,
      action: 'update',
    });
    return contact;
  }
}
