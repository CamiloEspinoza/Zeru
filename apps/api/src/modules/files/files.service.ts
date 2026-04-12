import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from './s3.service';
import { DocumentCategory } from '@prisma/client';
import { USER_SUMMARY_SELECT, mapUserWithAvatar } from '../users/user-select';

export interface CreateDocumentInput {
  name: string;
  mimeType: string;
  buffer: Buffer;
  sizeBytes: number;
  conversationId?: string;
}

export interface FindAllFilters {
  category?: DocumentCategory;
  tag?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  async create(
    tenantId: string,
    userId: string,
    input: CreateDocumentInput,
  ) {
    const docId = randomUUID();
    const s3Key = S3Service.buildKey(tenantId, docId, input.name);

    await this.s3.upload(tenantId, s3Key, input.buffer, input.mimeType);

    const doc = await this.prisma.document.create({
      data: {
        id: docId,
        name: input.name,
        s3Key,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        tenantId,
        uploadedById: userId,
        conversationId: input.conversationId ?? null,
      },
    });

    return doc;
  }

  async findAll(tenantId: string, filters: FindAllFilters = {}) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { tenantId };

    if (filters.category) where['category'] = filters.category;
    if (filters.tag) where['tags'] = { has: filters.tag };
    if (filters.from || filters.to) {
      where['createdAt'] = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to + 'T23:59:59Z') } : {}),
      };
    }

    const [rawDocs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { createdAt: 'desc' },
        include: {
          uploadedBy: { select: USER_SUMMARY_SELECT },
          conversation: { select: { id: true, title: true } },
          journalEntries: {
            include: {
              journalEntry: {
                select: { id: true, number: true, description: true, status: true },
              },
            },
          },
        },
      }),
      this.prisma.document.count({ where }),
    ]);

    const docs = rawDocs.map((d) => ({
      ...d,
      uploadedBy: d.uploadedBy ? mapUserWithAvatar(d.uploadedBy) : null,
    }));

    return {
      data: docs,
      meta: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    };
  }

  async findById(tenantId: string, docId: string) {
    const rawDoc = await this.prisma.document.findFirst({
      where: { id: docId, tenantId },
      include: {
        uploadedBy: { select: USER_SUMMARY_SELECT },
        conversation: { select: { id: true, title: true } },
        journalEntries: {
          include: {
            journalEntry: {
              select: { id: true, number: true, description: true, date: true, status: true },
            },
          },
        },
      },
    });

    if (!rawDoc) throw new NotFoundException('Documento no encontrado');

    const downloadUrl = await this.s3.getPresignedUrl(tenantId, rawDoc.s3Key, 3600);
    return {
      ...rawDoc,
      uploadedBy: rawDoc.uploadedBy ? mapUserWithAvatar(rawDoc.uploadedBy) : null,
      downloadUrl,
    };
  }

  async updateMetadata(
    tenantId: string,
    docId: string,
    category: DocumentCategory,
    tags: string[],
  ) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, tenantId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    return this.prisma.document.update({
      where: { id: docId },
      data: { category, tags },
    });
  }

  async linkToJournalEntry(
    tenantId: string,
    docId: string,
    journalEntryId: string,
  ) {
    // Verify both belong to tenant
    const [doc, entry] = await Promise.all([
      this.prisma.document.findFirst({ where: { id: docId, tenantId } }),
      this.prisma.journalEntry.findFirst({ where: { id: journalEntryId, tenantId } }),
    ]);

    if (!doc) throw new NotFoundException('Documento no encontrado');
    if (!entry) throw new NotFoundException('Asiento contable no encontrado');

    // Upsert to avoid duplicate
    return this.prisma.documentJournalEntry.upsert({
      where: { documentId_journalEntryId: { documentId: docId, journalEntryId } },
      create: { documentId: docId, journalEntryId },
      update: {},
    });
  }

  /** Returns journal entries already linked to a document. Used to avoid duplicate entries. */
  async getJournalEntriesForDocument(tenantId: string, documentId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true },
    });
    if (!doc) return { entries: [] };

    const links = await this.prisma.documentJournalEntry.findMany({
      where: { documentId },
      select: { journalEntryId: true },
    });
    const entryIds = links.map((l: { journalEntryId: string }) => l.journalEntryId);
    if (entryIds.length === 0) return { entries: [] };

    const entries = await this.prisma.journalEntry.findMany({
      where: { id: { in: entryIds }, tenantId },
      select: { id: true, number: true, description: true, date: true, status: true },
    });
    return { entries };
  }

  /** Associates uploaded documents to a conversation (called after conversation is created/confirmed). */
  async attachToConversation(tenantId: string, docIds: string[], conversationId: string) {
    await this.prisma.document.updateMany({
      where: { id: { in: docIds }, tenantId, conversationId: null },
      data: { conversationId },
    });
  }

  /** Returns lightweight doc info needed for LLM context (s3Key + mimeType). */
  async findManyByIds(tenantId: string, docIds: string[]) {
    return this.prisma.document.findMany({
      where: { id: { in: docIds }, tenantId },
      select: { id: true, name: true, mimeType: true, s3Key: true },
    }) as Promise<Array<{ id: string; name: string; mimeType: string; s3Key: string }>>;
  }

  async remove(tenantId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, tenantId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.s3.delete(tenantId, doc.s3Key);
    await this.prisma.document.delete({ where: { id: docId } });
    return { deleted: true };
  }
}
