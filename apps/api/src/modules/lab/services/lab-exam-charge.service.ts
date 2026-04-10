import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { toLabPaymentMethod, toLabChargeStatus, toLabExamChargeSource } from '../constants/enum-maps';
import type {
  CreateExamChargeSchema,
  UpdateExamChargeSchema,
  CancelExamChargeSchema,
  LabChargeListSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabExamChargeService {
  private readonly logger = new Logger(LabExamChargeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, filters: LabChargeListSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = { tenantId };
    if (where.diagnosticReportId) whereClause.diagnosticReportId = where.diagnosticReportId;
    if (where.liquidationId) whereClause.liquidationId = where.liquidationId;
    if (where.directPaymentBatchId) whereClause.directPaymentBatchId = where.directPaymentBatchId;
    if (where.labOriginId) whereClause.labOriginId = where.labOriginId;
    if (where.legalEntityId) whereClause.legalEntityId = where.legalEntityId;
    if (where.status) whereClause.status = toLabChargeStatus(where.status);
    if (where.dateFrom || where.dateTo) {
      whereClause.enteredAt = {
        ...(where.dateFrom ? { gte: new Date(where.dateFrom) } : {}),
        ...(where.dateTo ? { lte: new Date(where.dateTo) } : {}),
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.labExamCharge.findMany({
        where: whereClause,
        include: {
          diagnosticReport: {
            select: {
              id: true,
              fmInformeNumber: true,
              fmSource: true,
              status: true,
              serviceRequest: {
                select: {
                  subjectFirstName: true,
                  subjectPaternalLastName: true,
                  subjectRut: true,
                  labOriginCodeSnapshot: true,
                },
              },
            },
          },
          liquidation: {
            select: { id: true, periodLabel: true, status: true },
          },
        },
        orderBy: { enteredAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labExamCharge.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
      include: {
        diagnosticReport: {
          select: {
            id: true,
            fmInformeNumber: true,
            fmSource: true,
            status: true,
            serviceRequest: {
              select: {
                id: true,
                subjectFirstName: true,
                subjectPaternalLastName: true,
                subjectMaternalLastName: true,
                subjectRut: true,
                labOriginCodeSnapshot: true,
                category: true,
              },
            },
          },
        },
        liquidation: true,
        directPaymentBatch: true,
      },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);
    return charge;
  }

  async create(tenantId: string, data: CreateExamChargeSchema) {
    // Verify DR exists
    const dr = await this.prisma.labDiagnosticReport.findFirst({
      where: { id: data.diagnosticReportId, tenantId },
      select: { id: true, fmInformeNumber: true },
    });
    if (!dr) {
      throw new BadRequestException(`DiagnosticReport ${data.diagnosticReportId} not found`);
    }

    // Generate a unique fmRecordPk for new charges (negative to avoid collision with FM PKs)
    const maxPk = await this.prisma.labExamCharge.aggregate({
      where: { tenantId, fmRecordPk: { lt: 0 } },
      _min: { fmRecordPk: true },
    });
    const newPk = (maxPk._min.fmRecordPk ?? 0) - 1;

    const charge = await this.prisma.labExamCharge.create({
      data: {
        tenantId,
        fmSource: toLabExamChargeSource(data.fmSource),
        fmRecordPk: newPk,
        diagnosticReportId: data.diagnosticReportId,
        billingConceptId: data.billingConceptId ?? null,
        feeCodesText: data.feeCodesText ?? null,
        feeCodes: data.feeCodes ?? [],
        paymentMethod: toLabPaymentMethod(data.paymentMethod),
        amount: new Decimal(data.amount),
        currency: data.currency ?? 'CLP',
        status: toLabChargeStatus('REGISTERED'),
        labOriginId: data.labOriginId,
        labOriginCodeSnapshot: data.labOriginCodeSnapshot,
        legalEntityId: data.legalEntityId ?? null,
        enteredAt: new Date(),
        enteredByNameSnapshot: data.enteredByNameSnapshot,
        pointOfEntry: data.pointOfEntry ?? null,
        notes: data.notes ?? null,
      },
    });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-exam-charge',
        entityId: charge.id,
        action: 'create',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return charge;
  }

  async update(id: string, tenantId: string, data: UpdateExamChargeSchema) {
    const existing = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`ExamCharge ${id} not found`);
    if (existing.status === 'CANCELLED_CHARGE') {
      throw new BadRequestException('Cannot update a cancelled charge');
    }

    const updateData: Record<string, unknown> = {};
    if (data.billingConceptId !== undefined) updateData.billingConceptId = data.billingConceptId;
    if (data.feeCodesText !== undefined) updateData.feeCodesText = data.feeCodesText;
    if (data.feeCodes !== undefined) updateData.feeCodes = data.feeCodes;
    if (data.paymentMethod !== undefined) updateData.paymentMethod = toLabPaymentMethod(data.paymentMethod);
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.notes !== undefined) updateData.notes = data.notes;

    const result = await this.prisma.labExamCharge.updateMany({
      where: { id, tenantId },
      data: updateData,
    });
    if (result.count === 0) throw new NotFoundException(`ExamCharge ${id} not found`);

    const updated = await this.prisma.labExamCharge.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-exam-charge',
        entityId: id,
        action: 'update',
        changedFields: Object.keys(data),
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }

  async cancel(id: string, tenantId: string, data: CancelExamChargeSchema) {
    const existing = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`ExamCharge ${id} not found`);
    if (existing.status === 'CANCELLED_CHARGE') {
      throw new BadRequestException('Charge already cancelled');
    }

    await this.prisma.labExamCharge.updateMany({
      where: { id, tenantId },
      data: {
        status: 'CANCELLED_CHARGE',
        cancelledAt: new Date(),
        cancelledByNameSnapshot: data.cancelledByNameSnapshot,
        cancelReason: data.cancelReason,
      },
    });
    const updated = await this.prisma.labExamCharge.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-exam-charge',
        entityId: id,
        action: 'cancel',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }

  async assignToLiquidation(id: string, tenantId: string, liquidationId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);

    const liq = await this.prisma.labLiquidation.findFirst({
      where: { id: liquidationId, tenantId },
    });
    if (!liq) throw new NotFoundException(`Liquidation ${liquidationId} not found`);

    await this.prisma.labExamCharge.updateMany({
      where: { id, tenantId },
      data: { liquidationId, directPaymentBatchId: null },
    });
    const updated = await this.prisma.labExamCharge.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-exam-charge',
        entityId: id,
        action: 'update',
        changedFields: ['liquidationId'],
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }

  async assignToDirectPaymentBatch(id: string, tenantId: string, batchId: string) {
    const charge = await this.prisma.labExamCharge.findFirst({
      where: { id, tenantId },
    });
    if (!charge) throw new NotFoundException(`ExamCharge ${id} not found`);

    const dpb = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!dpb) throw new NotFoundException(`DirectPaymentBatch ${batchId} not found`);

    await this.prisma.labExamCharge.updateMany({
      where: { id, tenantId },
      data: { directPaymentBatchId: batchId, liquidationId: null },
    });
    const updated = await this.prisma.labExamCharge.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-exam-charge',
        entityId: id,
        action: 'update',
        changedFields: ['directPaymentBatchId'],
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }
}
