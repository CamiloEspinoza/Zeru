import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { MemoryCategory } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from './ai-config.service';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

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
  similarity?: number;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
  ) {}

  /**
   * Generates an embedding vector for the given text using the tenant's OpenAI key.
   */
  private async generateEmbedding(tenantId: string, text: string): Promise<number[] | null> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      this.logger.warn(`No API key for tenant ${tenantId}, skipping embedding generation`);
      return null;
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    return response.data[0].embedding;
  }

  /**
   * Formats a float array as a pgvector literal: '[0.1,0.2,...]'
   */
  private formatVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Stores a memory with semantic embedding.
   * If the tenant has no API key, the memory is stored without an embedding
   * (it will still be returned in list() but not via semantic search).
   */
  async store(params: {
    tenantId: string;
    userId: string | null;
    content: string;
    category: MemoryCategory;
    importance: number;
  }): Promise<MemoryRecord> {
    const { tenantId, userId, content, category, importance } = params;

    const embedding = await this.generateEmbedding(tenantId, content).catch((err) => {
      this.logger.error(`Failed to generate embedding: ${err.message}`);
      return null;
    });

    const id = crypto.randomUUID();
    const now = new Date();

    if (embedding) {
      const vector = this.formatVector(embedding);
      await this.prisma.$executeRawUnsafe(
        `INSERT INTO memories (id, content, category, importance, embedding, "isActive", "createdAt", "updatedAt", "tenantId", "userId")
         VALUES ($1, $2, $3::\"memory_category\", $4, $5::vector, true, $6, $7, $8, $9)`,
        id,
        content,
        category,
        importance,
        vector,
        now,
        now,
        tenantId,
        userId,
      );
    } else {
      await this.prisma.memory.create({
        data: { id, content, category, importance, tenantId, userId, createdAt: now, updatedAt: now },
      });
    }

    return { id, content, category, importance, isActive: true, createdAt: now, updatedAt: now, tenantId, userId };
  }

  /**
   * Semantic similarity search over memories for a given tenant.
   * Searches both tenant-scope (userId=null) and user-scope (userId=userId) memories.
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
      // 'all': tenant-wide + the specific user's personal memories
      if (userId) {
        scopeClause = `"tenantId" = '${tenantId}' AND ("userId" IS NULL OR "userId" = '${userId}')`;
      } else {
        scopeClause = `"tenantId" = '${tenantId}' AND "userId" IS NULL`;
      }
    }

    const rows = await this.prisma.$queryRawUnsafe<Array<MemoryRecord & { similarity: number }>>(
      `SELECT id, content, category, importance, "isActive", "createdAt", "updatedAt", "tenantId", "userId",
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
    includeUserScope?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<MemoryRecord[]> {
    const { tenantId, userId, includeUserScope = true, limit = 20, offset = 0 } = params;

    const whereUserId = includeUserScope && userId
      ? { OR: [{ userId: null }, { userId }] }
      : { userId: null };

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
      },
    });

    return rows as MemoryRecord[];
  }

  /**
   * Soft-deletes a memory (sets isActive=false).
   */
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
   * Updates the content of a memory and regenerates its embedding.
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

    if (content && content !== memory.content) {
      const embedding = await this.generateEmbedding(tenantId, newContent).catch(() => null);
      if (embedding) {
        const vector = this.formatVector(embedding);
        await this.prisma.$executeRawUnsafe(
          `UPDATE memories SET content = $1, category = $2::\"memory_category\", importance = $3, embedding = $4::vector, "updatedAt" = $5 WHERE id = $6`,
          newContent,
          newCategory,
          newImportance,
          vector,
          new Date(),
          memoryId,
        );
      } else {
        await this.prisma.memory.update({
          where: { id: memoryId },
          data: { content: newContent, category: newCategory, importance: newImportance },
        });
      }
    } else {
      await this.prisma.memory.update({
        where: { id: memoryId },
        data: { category: newCategory, importance: newImportance },
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
