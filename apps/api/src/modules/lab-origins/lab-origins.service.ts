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
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        legalEntityId: true,
        billingAgreementId: true,
        parentId: true,
        sampleReceptionMode: true,
        reportDeliveryMethods: true,
        deliveryDaysBiopsy: true,
        deliveryDaysPap: true,
        sendsQualityReports: true,
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        billingAgreement: { select: { id: true, code: true, name: true, status: true } },
        parent: { select: { id: true, code: true, name: true } },
        _count: { select: { children: true } },
      },
    });
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        legalEntityId: true,
        parentId: true,
        billingAgreementId: true,
        street: true,
        streetNumber: true,
        unit: true,
        commune: true,
        city: true,
        phone: true,
        email: true,
        sampleReceptionMode: true,
        reportDeliveryMethods: true,
        deliveryDaysBiopsy: true,
        deliveryDaysPap: true,
        deliveryDaysCytology: true,
        deliveryDaysIhc: true,
        deliveryDaysDefault: true,
        ftpPath: true,
        encryptedFtpHost: true,
        encryptedFtpUser: true,
        encryptedFtpPassword: true,
        criticalNotificationEmails: true,
        sendsQualityReports: true,
        receptionDays: true,
        receptionSchedule: true,
        notes: true,
        isActive: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        legalEntity: { select: { id: true, rut: true, legalName: true } },
        billingAgreement: { select: { id: true, code: true, name: true, status: true } },
        parent: { select: { id: true, code: true, name: true } },
        children: {
          where: { isActive: true },
          orderBy: { code: 'asc' },
          select: { id: true, code: true, name: true, category: true },
        },
      },
    });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    return this.maskFtp(origin);
  }

  async create(tenantId: string, data: CreateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.create({
      data,
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'lab-origin',
      entityId: origin.id,
      action: 'create',
    });
    return this.maskFtp(origin);
  }

  async update(id: string, tenantId: string, data: UpdateLabOriginSchema) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const origin = await client.labOrigin.findUnique({ where: { id } });
    if (!origin) throw new NotFoundException(`LabOrigin ${id} not found`);
    const updated = await client.labOrigin.update({
      where: { id },
      data,
    });
    this.eventEmitter.emit('fm.sync', {
      tenantId,
      entityType: 'lab-origin',
      entityId: id,
      action: 'update',
    });
    return this.maskFtp(updated);
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

  private maskFtp<
    T extends {
      encryptedFtpHost?: string | null;
      encryptedFtpUser?: string | null;
      encryptedFtpPassword?: string | null;
    },
  >(origin: T) {
    const { encryptedFtpHost, encryptedFtpUser, encryptedFtpPassword, ...rest } = origin;
    return {
      ...rest,
      hasFtpHost: !!encryptedFtpHost,
      hasFtpUser: !!encryptedFtpUser,
      hasFtpPassword: !!encryptedFtpPassword,
    };
  }
}
