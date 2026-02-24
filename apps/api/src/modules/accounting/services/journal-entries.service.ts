import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateJournalEntrySchema } from '@zeru/shared';

@Injectable()
export class JournalEntriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    tenantId: string,
    query?: { page?: number; perPage?: number; status?: 'DRAFT' | 'POSTED' | 'VOIDED' },
  ) {
    const page = query?.page ?? 1;
    const perPage = query?.perPage ?? 10;
    const skip = (page - 1) * perPage;

    const client = this.prisma.forTenant(tenantId) as any;

    const where = query?.status ? { status: query.status } : {};

    const [entries, total] = await Promise.all([
      client.journalEntry.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      }),
      client.journalEntry.count({ where }),
    ]);

    return {
      data: entries,
      meta: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  async findById(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const entry = await client.journalEntry.findUnique({
      where: { id },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    return entry;
  }

  async create(tenantId: string, data: CreateJournalEntrySchema) {
    const client = this.prisma.forTenant(tenantId) as any;

    const maxEntry = await client.journalEntry.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const nextNumber = (maxEntry?.number ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          tenantId,
          number: nextNumber,
          date: new Date(data.date),
          description: data.description,
          fiscalPeriodId: data.fiscalPeriodId,
          status: 'DRAFT',
          lines: {
            create: data.lines.map((line) => ({
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
              description: line.description,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      });

      return entry;
    });
  }

  async post(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const entry = await client.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    if (entry.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only DRAFT entries can be posted',
      );
    }

    return client.journalEntry.update({
      where: { id },
      data: { status: 'POSTED' },
    });
  }

  async void(id: string, tenantId: string) {
    const client = this.prisma.forTenant(tenantId) as any;

    const entry = await client.journalEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    if (entry.status !== 'POSTED') {
      throw new BadRequestException(
        'Only POSTED entries can be voided',
      );
    }

    return client.journalEntry.update({
      where: { id },
      data: { status: 'VOIDED' },
    });
  }
}
