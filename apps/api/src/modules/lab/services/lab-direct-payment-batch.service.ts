import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../../prisma/prisma.service';
import { toDirectPaymentStatus } from '../constants/enum-maps';
import type {
  CreateDirectPaymentBatchSchema,
  CloseDirectPaymentBatchSchema,
} from '@zeru/shared';
import type { FmLabSyncEvent } from './fm-lab-sync.service';

@Injectable()
export class LabDirectPaymentBatchService {
  private readonly logger = new Logger(LabDirectPaymentBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(
    tenantId: string,
    filters: { page?: number; pageSize?: number; status?: string; legalEntityId?: string } = {},
  ) {
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    const skip = (page - 1) * pageSize;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenantId };
    if (filters.status) where.status = toDirectPaymentStatus(filters.status);
    if (filters.legalEntityId) where.legalEntityId = filters.legalEntityId;

    const [items, total] = await Promise.all([
      this.prisma.labDirectPaymentBatch.findMany({
        where,
        include: {
          _count: { select: { charges: true } },
        },
        orderBy: { period: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labDirectPaymentBatch.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const batch = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id, tenantId },
      include: {
        charges: {
          include: {
            diagnosticReport: {
              select: {
                fmInformeNumber: true,
                serviceRequest: {
                  select: {
                    subjectFirstName: true,
                    subjectPaternalLastName: true,
                    subjectRut: true,
                  },
                },
              },
            },
          },
          orderBy: { enteredAt: 'desc' },
        },
      },
    });
    if (!batch) throw new NotFoundException(`DirectPaymentBatch ${id} not found`);
    return batch;
  }

  async create(tenantId: string, data: CreateDirectPaymentBatchSchema) {
    const fmRecordId = `zeru-dpb-${Date.now()}`;

    const batch = await this.prisma.labDirectPaymentBatch.create({
      data: {
        tenantId,
        fmRecordId,
        period: new Date(data.period),
        periodFrom: data.periodFrom ? new Date(data.periodFrom) : null,
        periodTo: data.periodTo ? new Date(data.periodTo) : null,
        legalEntityId: data.legalEntityId ?? null,
        rendicionType: data.rendicionType,
        totalAmount: new Decimal(0),
        chargeCount: 0,
        rendidoByNameSnapshot: data.rendidoByNameSnapshot ?? null,
        rendidoAt: new Date(),
        status: 'OPEN_DPB',
        notes: data.notes ?? null,
      },
    });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-direct-payment-batch',
        entityId: batch.id,
        action: 'create',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return batch;
  }

  async close(id: string, tenantId: string, data: CloseDirectPaymentBatchSchema) {
    const batch = await this.prisma.labDirectPaymentBatch.findFirst({
      where: { id, tenantId },
    });
    if (!batch) throw new NotFoundException(`DirectPaymentBatch ${id} not found`);
    if (batch.status !== 'OPEN_DPB') {
      throw new BadRequestException(`Cannot close batch in status ${batch.status}`);
    }

    // Compute totals from assigned charges
    const chargeAgg = await this.prisma.labExamCharge.aggregate({
      where: { directPaymentBatchId: id, tenantId },
      _sum: { amount: true },
      _count: true,
    });

    await this.prisma.labDirectPaymentBatch.updateMany({
      where: { id, tenantId },
      data: {
        status: 'RENDIDA',
        totalAmount: chargeAgg._sum.amount ?? new Decimal(0),
        chargeCount: chargeAgg._count,
        receiptNumber: data.receiptNumber ?? null,
        receiptDate: data.receiptDate ? new Date(data.receiptDate) : null,
      },
    });
    const updated = await this.prisma.labDirectPaymentBatch.findUniqueOrThrow({ where: { id } });

    try {
      this.eventEmitter.emit('fm.lab.sync', {
        tenantId,
        entityType: 'lab-direct-payment-batch',
        entityId: id,
        action: 'close',
      } satisfies FmLabSyncEvent);
    } catch (error) {
      this.logger.error(`Failed to emit fm.lab.sync: ${error instanceof Error ? error.message : error}`);
    }

    return updated;
  }
}
