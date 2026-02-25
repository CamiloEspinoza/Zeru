import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateJournalEntrySchema } from '@zeru/shared';

export interface CreateJournalEntryMeta {
  createdById: string;
  createdVia: 'ASSISTANT' | 'MANUAL';
  conversationId?: string | null;
}

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

    const where = query?.status ? { status: query.status, tenantId } : { tenantId };

    const [entries, total] = await Promise.all([
      (this.prisma as any).journalEntry.findMany({
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
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          conversation: {
            select: { id: true, title: true },
          },
        },
      }),
      (this.prisma as any).journalEntry.count({ where }),
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
    // Use main prisma so include of documents (DocumentJournalEntry + Document) is not filtered by tenant extension
    const entry = await (this.prisma as any).journalEntry.findFirst({
      where: { id, tenantId },
      include: {
        lines: {
          include: {
            account: true,
          },
        },
        documents: {
          include: {
            document: {
              select: { id: true, name: true, mimeType: true, sizeBytes: true },
            },
          },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        conversation: {
          select: { id: true, title: true },
        },
      },
    });

    if (!entry) {
      throw new NotFoundException(`Journal entry with id ${id} not found`);
    }

    // Normalize to documents[] with document shape for the API response
    const documents = (entry.documents ?? []).map(
      (d: { document: { id: string; name: string; mimeType: string; sizeBytes: number } }) => d.document,
    );
    const { documents: _docRel, ...rest } = entry;
    return { ...rest, documents };
  }

  async create(
    tenantId: string,
    data: CreateJournalEntrySchema,
    meta?: CreateJournalEntryMeta,
  ) {
    const client = this.prisma.forTenant(tenantId) as any;

    const maxEntry = await client.journalEntry.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    const nextNumber = (maxEntry?.number ?? 0) + 1;

    return this.prisma.$transaction(async (tx) => {
      const entry = await (tx as any).journalEntry.create({
        data: {
          tenantId,
          number: nextNumber,
          date: new Date(data.date),
          description: data.description,
          fiscalPeriodId: data.fiscalPeriodId,
          status: 'DRAFT',
          ...(meta && {
            createdById: meta.createdById,
            createdVia: meta.createdVia,
            conversationId: meta.conversationId ?? null,
          }),
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
