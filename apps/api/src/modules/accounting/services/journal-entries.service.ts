import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  BatchJournalEntryItemSchema,
  CreateJournalEntrySchema,
} from '@zeru/shared';

export interface CreateJournalEntryMeta {
  createdById?: string;
  createdVia?: 'ASSISTANT' | 'MANUAL';
  conversationId?: string | null;
}

type BatchCreateErrorCode =
  | 'validation_error'
  | 'unbalanced'
  | 'invalid_account'
  | 'invalid_period'
  | 'period_closed';

type BatchCreateResultItem =
  | {
      index: number;
      external_id?: string;
      status: 'created';
      entry: { id: string; number: number; status: 'DRAFT' | 'POSTED' };
    }
  | {
      index: number;
      external_id?: string;
      status: 'failed';
      error: { code: BatchCreateErrorCode; message: string };
    };

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

  async createBatch(
    tenantId: string,
    entries: BatchJournalEntryItemSchema[],
    options?: { autoPost?: boolean; meta?: CreateJournalEntryMeta },
  ) {
    if (entries.length === 0) {
      return {
        total: 0,
        created: 0,
        failed: 0,
        results: [] as BatchCreateResultItem[],
      };
    }

    const accountIds = Array.from(
      new Set(entries.flatMap((entry) => entry.lines.map((line) => line.accountId))),
    );
    const fiscalPeriodIds = Array.from(
      new Set(entries.map((entry) => entry.fiscalPeriodId)),
    );

    const [accounts, periods] = await Promise.all([
      (this.prisma as any).account.findMany({
        where: { tenantId, id: { in: accountIds } },
        select: { id: true },
      }),
      (this.prisma as any).fiscalPeriod.findMany({
        where: { tenantId, id: { in: fiscalPeriodIds } },
        select: { id: true, status: true },
      }),
    ]);

    const validAccountIds = new Set<string>(accounts.map((a: { id: string }) => a.id));
    const periodsById = new Map<string, 'OPEN' | 'CLOSED'>(
      periods.map((p: { id: string; status: 'OPEN' | 'CLOSED' }) => [p.id, p.status]),
    );

    const failures: BatchCreateResultItem[] = [];
    const validEntries: Array<{
      index: number;
      external_id?: string;
      entry: BatchJournalEntryItemSchema;
    }> = [];

    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];

      const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0);
      const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0);
      if (Math.abs(totalDebit - totalCredit) >= 0.01) {
        failures.push({
          index,
          external_id: entry.external_id,
          status: 'failed',
          error: {
            code: 'unbalanced',
            message: 'Debe y Haber deben ser iguales',
          },
        });
        continue;
      }

      const missingAccounts = entry.lines
        .map((line) => line.accountId)
        .filter((accountId) => !validAccountIds.has(accountId));
      if (missingAccounts.length > 0) {
        failures.push({
          index,
          external_id: entry.external_id,
          status: 'failed',
          error: {
            code: 'invalid_account',
            message: `Una o más cuentas no existen en el tenant: ${Array.from(
              new Set(missingAccounts),
            ).join(', ')}`,
          },
        });
        continue;
      }

      const periodStatus = periodsById.get(entry.fiscalPeriodId);
      if (!periodStatus) {
        failures.push({
          index,
          external_id: entry.external_id,
          status: 'failed',
          error: {
            code: 'invalid_period',
            message: `El período fiscal ${entry.fiscalPeriodId} no existe`,
          },
        });
        continue;
      }
      if (periodStatus !== 'OPEN') {
        failures.push({
          index,
          external_id: entry.external_id,
          status: 'failed',
          error: {
            code: 'period_closed',
            message: `El período fiscal ${entry.fiscalPeriodId} está cerrado`,
          },
        });
        continue;
      }

      validEntries.push({ index, external_id: entry.external_id, entry });
    }

    const createdResults: BatchCreateResultItem[] = [];
    if (validEntries.length > 0) {
      const client = this.prisma.forTenant(tenantId) as any;
      const maxEntry = await client.journalEntry.findFirst({
        orderBy: { number: 'desc' },
        select: { number: true },
      });
      let nextNumber = (maxEntry?.number ?? 0) + 1;

      const status = options?.autoPost ? 'POSTED' : 'DRAFT';

      await this.prisma.$transaction(async (tx) => {
        for (const item of validEntries) {
          const created = await (tx as any).journalEntry.create({
            data: {
              tenantId,
              number: nextNumber,
              date: new Date(item.entry.date),
              description: item.entry.description,
              fiscalPeriodId: item.entry.fiscalPeriodId,
              status,
              ...(options?.meta && {
                createdById: options.meta.createdById,
                createdVia: options.meta.createdVia,
                conversationId: options.meta.conversationId ?? null,
              }),
              lines: {
                create: item.entry.lines.map((line) => ({
                  accountId: line.accountId,
                  debit: line.debit,
                  credit: line.credit,
                  description: line.description,
                })),
              },
            },
            select: { id: true, number: true, status: true },
          });

          createdResults.push({
            index: item.index,
            external_id: item.external_id,
            status: 'created',
            entry: {
              id: created.id,
              number: created.number,
              status: created.status,
            },
          });
          nextNumber += 1;
        }
      });
    }

    const results = [...createdResults, ...failures].sort(
      (a, b) => a.index - b.index,
    );
    const created = createdResults.length;
    const failed = failures.length;

    return {
      total: entries.length,
      created,
      failed,
      results,
    };
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
