import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { MemoryCategory } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from './ai-config.service';
import { BackgroundQueueService } from './background-queue.service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_TIMEOUT_MS = 15_000;

export interface MemoryRecord {
  id: string;
  content: string;
  category: MemoryCategory;
  importance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
  userId: string | null;
  documentId: string | null;
  similarity?: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private openaiClientCache = new Map<string, OpenAI>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
    private readonly backgroundQueue: BackgroundQueueService,
  ) {}

  private getOpenAIClient(apiKey: string): OpenAI {
    let client = this.openaiClientCache.get(apiKey);
    if (!client) {
      client = new OpenAI({ apiKey, timeout: EMBEDDING_TIMEOUT_MS });
      this.openaiClientCache.set(apiKey, client);
    }
    return client;
  }

  private async generateEmbedding(tenantId: string, text: string): Promise<number[] | null> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      this.logger.warn(`No API key for tenant ${tenantId}, skipping embedding`);
      return null;
    }

    const openai = this.getOpenAIClient(apiKey);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  }

  private formatVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Saves the embedding vector for a memory record.
   * Called from the background queue — safe to retry.
   */
  private async saveEmbedding(memoryId: string, tenantId: string, content: string): Promise<void> {
    const embedding = await this.generateEmbedding(tenantId, content);
    if (!embedding) return;

    const vector = this.formatVector(embedding);
    await this.prisma.$executeRawUnsafe(
      `UPDATE memories SET embedding = $1::vector, "updatedAt" = $2 WHERE id = $3 AND "tenantId" = $4`,
      vector,
      new Date(),
      memoryId,
      tenantId,
    );
  }

  /**
   * Stores a memory instantly (DB insert without embedding) and enqueues
   * embedding generation as a background job with automatic retries.
   */
  async store(params: {
    tenantId: string;
    userId: string | null;
    content: string;
    category: MemoryCategory;
    importance: number;
    documentId?: string | null;
  }): Promise<MemoryRecord> {
    const { tenantId, userId, content, category, importance, documentId } = params;

    const id = crypto.randomUUID();
    const now = new Date();

    await this.prisma.memory.create({
      data: {
        id,
        content,
        category,
        importance,
        tenantId,
        userId,
        documentId: documentId ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });

    this.backgroundQueue.enqueue({
      name: `embedding:${id.slice(0, 8)}`,
      fn: () => this.saveEmbedding(id, tenantId, content),
    });

    return { id, content, category, importance, isActive: true, createdAt: now, updatedAt: now, tenantId, userId, documentId: documentId ?? null };
  }

  /**
   * Semantic similarity search over memories for a given tenant.
   * Falls back to recency-ordered list when no embedding can be generated.
   */
  async search(params: {
    tenantId: string;
    userId: string | null;
    query: string;
    scope?: 'tenant' | 'user' | 'all';
    limit?: number;
  }): Promise<MemoryRecord[]> {
    const { tenantId, userId, query, scope = 'all', limit = 5 } = params;

    const embedding = await this.generateEmbedding(tenantId, query).catch(() => null);
    if (!embedding) {
      return this.list({ tenantId, userId, limit });
    }

    const vector = this.formatVector(embedding);

    let scopeClause: string;
    if (scope === 'tenant') {
      scopeClause = `"tenantId" = '${tenantId}' AND "userId" IS NULL`;
    } else if (scope === 'user' && userId) {
      scopeClause = `"tenantId" = '${tenantId}' AND "userId" = '${userId}'`;
    } else {
      if (userId) {
        scopeClause = `"tenantId" = '${tenantId}' AND ("userId" IS NULL OR "userId" = '${userId}')`;
      } else {
        scopeClause = `"tenantId" = '${tenantId}' AND "userId" IS NULL`;
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<MemoryRecord & { similarity: number }>>(
      `SELECT id, content, category, importance, "isActive", "createdAt", "updatedAt", "tenantId", "userId", "documentId",
              1 - (embedding <=> $1::vector) AS similarity
       FROM memories
       WHERE "isActive" = true
         AND embedding IS NOT NULL
         AND ${scopeClause}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      vector,
      limit,
    );

    return rows;
  }

  /**
   * Returns the most recent active memories (no vector search).
   */
  async list(params: {
    tenantId: string;
    userId?: string | null;
    scope?: 'tenant' | 'user' | 'all';
    limit?: number;
    offset?: number;
  }): Promise<MemoryRecord[]> {
    const { tenantId, userId, scope = 'all', limit = 20, offset = 0 } = params;

    let whereUserId: object;
    if (scope === 'tenant') {
      whereUserId = { userId: null };
    } else if (scope === 'user' && userId) {
      whereUserId = { userId };
    } else {
      whereUserId = userId
        ? { OR: [{ userId: null }, { userId }] }
        : { userId: null };
    }

    const rows = await this.prisma.memory.findMany({
      where: { tenantId, isActive: true, ...whereUserId },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        content: true,
        category: true,
        importance: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        tenantId: true,
        userId: true,
        documentId: true,
      },
    });

    return rows as MemoryRecord[];
  }

  async delete(memoryId: string, tenantId: string): Promise<boolean> {
    const memory = await this.prisma.memory.findFirst({
      where: { id: memoryId, tenantId, isActive: true },
    });

    if (!memory) return false;

    await this.prisma.memory.update({
      where: { id: memoryId },
      data: { isActive: false },
    });

    return true;
  }

  /**
   * Updates a memory's content/metadata. If content changed, enqueues
   * a background job to regenerate the embedding.
   */
  async update(params: {
    memoryId: string;
    tenantId: string;
    content?: string;
    category?: MemoryCategory;
    importance?: number;
  }): Promise<MemoryRecord | null> {
    const { memoryId, tenantId, content, category, importance } = params;

    const memory = await this.prisma.memory.findFirst({
      where: { id: memoryId, tenantId, isActive: true },
    });
    if (!memory) return null;

    const newContent = content ?? memory.content;
    const newCategory = category ?? memory.category;
    const newImportance = importance ?? memory.importance;

    await this.prisma.memory.update({
      where: { id: memoryId },
      data: { content: newContent, category: newCategory, importance: newImportance },
    });

    if (content && content !== memory.content) {
      this.backgroundQueue.enqueue({
        name: `embedding-update:${memoryId.slice(0, 8)}`,
        fn: () => this.saveEmbedding(memoryId, tenantId, newContent),
      });
    }

    return this.prisma.memory.findUnique({ where: { id: memoryId } }) as Promise<MemoryRecord>;
  }

  /**
   * Builds a formatted memory context string to inject into the system prompt.
   * Performs semantic search using the user's message as query.
   */
  async getContextForConversation(params: {
    tenantId: string;
    userId: string;
    userMessage: string;
  }): Promise<string | null> {
    const { tenantId, userId, userMessage } = params;

    const memories = await this.search({
      tenantId,
      userId,
      query: userMessage,
      scope: 'all',
      limit: 8,
    }).catch((err) => {
      this.logger.error(`Memory search failed: ${err.message}`);
      return [];
    });

    if (!memories.length) return null;

    const tenantMemories = memories.filter((m) => m.userId === null);
    const userMemories = memories.filter((m) => m.userId !== null);

    const lines: string[] = [];

    if (tenantMemories.length) {
      lines.push('### Contexto de la organización');
      for (const m of tenantMemories) {
        lines.push(`- [${m.category}] ${m.content}`);
      }
    }

    if (userMemories.length) {
      if (lines.length) lines.push('');
      lines.push('### Preferencias del usuario');
      for (const m of userMemories) {
        lines.push(`- [${m.category}] ${m.content}`);
      }
    }

    return lines.join('\n');
  }
}
