import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { toLiquidationStatus } from '../constants/enum-maps';
import type {
  CreateLiquidationSchema,
  ConfirmLiquidationSchema,
  InvoiceLiquidationSchema,
  PaymentLiquidationSchema,
  LabLiquidationListSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabLiquidationService {
  private readonly logger = new Logger(LabLiquidationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, filters: LabLiquidationListSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.legalEntityId) whereClause.legalEntityId = where.legalEntityId;
    if (where.status) whereClause.status = toLiquidationStatus(where.status);
    if (where.periodFrom || where.periodTo) {
      whereClause.period = {
        ...(where.periodFrom ? { gte: new Date(where.periodFrom) } : {}),
        ...(where.periodTo ? { lte: new Date(where.periodTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.labLiquidation.findMany({
        where: whereClause,
        include: {
          _count: { select: { charges: true } },
        },
        orderBy: { period: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labLiquidation.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
      include: {
        charges: {
          include: {
            diagnosticReport: {
              select: {
                fmInformeNumber: true,
                fmSource: true,
                serviceRequest: {
                  select: {
                    subjectFirstName: true,
                    subjectPaternalLastName: true,
                    subjectRut: true,
                    category: true,
                  },
                },
              },
            },
          },
          orderBy: { enteredAt: 'desc' },
        },
      },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    return liq;
  }

  async create(tenantId: string, data: CreateLiquidationSchema) {
    // Generate unique fmRecordId for new liquidations
    const fmRecordId = `zeru-liq-${Date.now()}`;

    const totalAmount =
      data.biopsyAmount + data.papAmount + data.cytologyAmount + data.immunoAmount
      + data.previousDebt - data.creditBalance;

    const liq = await this.prisma.labLiquidation.create({
      data: {
        tenantId,
        fmRecordId,
        legalEntityId: data.legalEntityId,
        billingAgreementId: data.billingAgreementId ?? null,
        period: new Date(data.period),
        periodLabel: data.periodLabel,
        totalAmount: new Decimal(totalAmount),
        biopsyAmount: new Decimal(data.biopsyAmount),
        papAmount: new Decimal(data.papAmount),
        cytologyAmount: new Decimal(data.cytologyAmount),
        immunoAmount: new Decimal(data.immunoAmount),
        biopsyCount: data.biopsyCount,
        papCount: data.papCount,
        cytologyCount: data.cytologyCount,
        immunoCount: data.immunoCount,
        previousDebt: new Decimal(data.previousDebt),
        creditBalance: new Decimal(data.creditBalance),
        status: toLiquidationStatus('DRAFT'),
        notes: data.notes ?? null,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: liq.id,
      action: 'create',
    } satisfies FmLabSyncEvent);

    return liq;
  }

  async confirm(id: string, tenantId: string, data: ConfirmLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'DRAFT_LIQ') {
      throw new BadRequestException(
        `Cannot confirm liquidation in status ${liq.status}`,
      );
    }

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedByNameSnapshot: data.confirmedByNameSnapshot,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'confirm',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async invoice(id: string, tenantId: string, data: InvoiceLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'CONFIRMED') {
      throw new BadRequestException(
        `Cannot invoice liquidation in status ${liq.status} (must be CONFIRMED)`,
      );
    }

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: 'INVOICED_LIQ',
        invoiceNumber: data.invoiceNumber,
        invoiceType: data.invoiceType ?? null,
        invoiceDate: new Date(data.invoiceDate),
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'invoice',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async registerPayment(id: string, tenantId: string, data: PaymentLiquidationSchema) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status !== 'INVOICED_LIQ' && liq.status !== 'PARTIALLY_PAID') {
      throw new BadRequestException(
        `Cannot register payment for liquidation in status ${liq.status}`,
      );
    }

    const totalPaid = Number(liq.paymentAmount ?? 0) + data.paymentAmount;
    const totalOwed = Number(liq.totalAmount);
    const newStatus = totalPaid >= totalOwed ? 'PAID_LIQ' : 'PARTIALLY_PAID';

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: {
        status: newStatus,
        paymentAmount: new Decimal(totalPaid),
        paymentDate: new Date(data.paymentDate),
        paymentMethodText: data.paymentMethodText,
      },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'payment',
    } satisfies FmLabSyncEvent);

    return updated;
  }

  async cancel(id: string, tenantId: string) {
    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${id} not found`);
    if (liq.status === 'CANCELLED_LIQ') {
      throw new BadRequestException('Liquidation is already cancelled');
    }
    if (liq.status === 'PAID_LIQ') {
      throw new BadRequestException('Cannot cancel a fully paid liquidation');
    }

    const updated = await this.prisma.labLiquidation.update({
      where: { id },
      data: { status: 'CANCELLED_LIQ' },
    });

    this.eventEmitter.emit('fm.lab.sync', {
      tenantId,
      entityType: 'lab-liquidation',
      entityId: id,
      action: 'cancel',
    } satisfies FmLabSyncEvent);

    return updated;
  }
}
