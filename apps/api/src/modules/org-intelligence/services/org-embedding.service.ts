import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from '../../ai/services/ai-config.service';

// ---------------------------------------------------------------------------
// Constants (matching memory.service.ts)
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_TIMEOUT_MS = 15_000;

/** OpenAI supports up to 2048 inputs per batch call. */
const BATCH_SIZE = 100;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OrgEmbeddingService {
  private readonly logger = new Logger(OrgEmbeddingService.name);
  private openaiClientCache = new Map<string, OpenAI>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Generate embeddings for all chunks of an interview that don't have one yet.
   * Uses text-embedding-3-small (1536 dims) — same as Memory system.
   */
  async embedInterviewChunks(
    tenantId: string,
    interviewId: string,
  ): Promise<void> {
    // 1. Load chunks without embeddings
    const chunks = await this.prisma.$queryRawUnsafe<
      Array<{ id: string; content: string; contextPrefix: string | null }>
    >(
      `SELECT id, content, "contextPrefix"
       FROM interview_chunks
       WHERE "interviewId" = $1
         AND "tenantId" = $2
         AND embedding IS NULL`,
      interviewId,
      tenantId,
    );

    if (chunks.length === 0) {
      this.logger.log(
        `[${interviewId}] No chunks to embed — all already have embeddings`,
      );
      return;
    }

    // 2. Build texts: contextPrefix + "\n\n" + content
    const texts = chunks.map((c) =>
      c.contextPrefix ? `${c.contextPrefix}\n\n${c.content}` : c.content,
    );

    // 3. Generate embeddings in batches
    const embeddings = await this.generateEmbeddings(texts, tenantId);

    // 4. Update each chunk via raw SQL
    let totalInputTokens = 0;
    for (let i = 0; i < chunks.length; i++) {
      const vector = this.formatVector(embeddings[i]);
      await this.prisma.$executeRawUnsafe(
        `UPDATE interview_chunks
         SET embedding = $1::vector, "embeddingModel" = $2
         WHERE id = $3`,
        vector,
        EMBEDDING_MODEL,
        chunks[i].id,
      );
      totalInputTokens += Math.ceil(texts[i].length / 4);
    }

    // 5. Log AI usage
    await this.logUsage(tenantId, totalInputTokens, 'org-chunk-embedding');

    this.logger.log(
      `[${interviewId}] Generated embeddings for ${chunks.length} chunks`,
    );
  }

  /**
   * Generate embeddings for org entities (for entity search).
   */
  async embedEntities(
    tenantId: string,
    projectId: string,
  ): Promise<void> {
    // 1. Load entities without embeddings
    const entities = await this.prisma.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        description: string | null;
        metadata: unknown;
      }>
    >(
      `SELECT id, name, description, metadata
       FROM org_entities
       WHERE "tenantId" = $1
         AND "projectId" = $2
         AND "deletedAt" IS NULL
         AND embedding IS NULL`,
      tenantId,
      projectId,
    );

    if (entities.length === 0) {
      this.logger.log(
        `[${projectId}] No entities to embed`,
      );
      return;
    }

    // 2. Build texts
    const texts = entities.map((e) => {
      const metaStr = e.metadata ? ' ' + JSON.stringify(e.metadata) : '';
      return `${e.name} - ${e.description ?? ''}${metaStr}`.trim();
    });

    // 3. Generate embeddings in batches
    const embeddings = await this.generateEmbeddings(texts, tenantId);

    // 4. Update each entity via raw SQL
    let totalInputTokens = 0;
    for (let i = 0; i < entities.length; i++) {
      const vector = this.formatVector(embeddings[i]);
      await this.prisma.$executeRawUnsafe(
        `UPDATE org_entities
         SET embedding = $1::vector
         WHERE id = $2`,
        vector,
        entities[i].id,
      );
      totalInputTokens += Math.ceil(texts[i].length / 4);
    }

    // 5. Log AI usage
    await this.logUsage(tenantId, totalInputTokens, 'org-entity-embedding');

    this.logger.log(
      `[${projectId}] Generated embeddings for ${entities.length} entities`,
    );
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private getOpenAIClient(apiKey: string): OpenAI {
    let client = this.openaiClientCache.get(apiKey);
    if (!client) {
      client = new OpenAI({ apiKey, timeout: EMBEDDING_TIMEOUT_MS });
      this.openaiClientCache.set(apiKey, client);
    }
    return client;
  }

  private formatVector(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }

  /**
   * Generate embeddings for an array of texts, processing in batches.
   * Follows the exact pattern from memory.service.ts.
   */
  private async generateEmbeddings(
    texts: string[],
    tenantId: string,
  ): Promise<number[][]> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      throw new Error(
        `No OpenAI API key configured for tenant ${tenantId}`,
      );
    }

    const openai = this.getOpenAIClient(apiKey);
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
        dimensions: EMBEDDING_DIMENSIONS,
      });

      // Response data is returned in the same order as input
      for (const item of response.data) {
        allEmbeddings.push(item.embedding);
      }
    }

    return allEmbeddings;
  }

  private async logUsage(
    tenantId: string,
    inputTokens: number,
    feature: string,
  ): Promise<void> {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          provider: 'OPENAI',
          model: EMBEDDING_MODEL,
          feature,
          inputTokens,
          outputTokens: 0,
          totalTokens: inputTokens,
          cachedTokens: 0,
          compacted: false,
          tenantId,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to log AI usage for ${feature}: ${(err as Error).message}`,
      );
    }
  }
}
