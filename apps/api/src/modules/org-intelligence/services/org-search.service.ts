import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { OrgEntityType } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from '../../ai/services/ai-config.service';

// ---------------------------------------------------------------------------
// Constants (matching memory.service.ts)
// ---------------------------------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;
const EMBEDDING_TIMEOUT_MS = 15_000;

/** Allowed OrgEntityType values — used for safe type filtering. */
const VALID_ENTITY_TYPES = new Set<string>(Object.values(OrgEntityType));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  id: string;
  content: string;
  contextPrefix: string | null;
  topicSummary: string | null;
  interviewId: string;
  speakerId: string | null;
  startTimeMs: number | null;
  endTimeMs: number | null;
  rrfScore: number;
}

export interface EntitySearchResult {
  id: string;
  type: string;
  name: string;
  description: string | null;
  metadata: unknown;
  projectId: string;
  similarity: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OrgSearchService {
  private readonly logger = new Logger(OrgSearchService.name);
  private openaiClientCache = new Map<string, OpenAI>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiConfig: AiConfigService,
  ) {}

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Hybrid search: BM25 (tsvector) + Vector (pgvector) + Reciprocal Rank Fusion.
   */
  async search(
    tenantId: string,
    projectId: string,
    query: string,
    limit = 10,
  ): Promise<SearchResult[]> {
    // 1. Generate query embedding
    const queryEmbedding = await this.generateQueryEmbedding(query, tenantId);
    const vector = this.formatVector(queryEmbedding);

    // 2. Run hybrid search with RRF via raw SQL inside a transaction
    //    so we can SET LOCAL hnsw.ef_search for better recall.
    const results = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = 100`);

      return tx.$queryRawUnsafe<SearchResult[]>(
        `
        WITH vector_results AS (
          SELECT c.id, c.content, c."contextPrefix", c."topicSummary",
                 c."interviewId", c."speakerId", c."startTimeMs", c."endTimeMs",
                 ROW_NUMBER() OVER (ORDER BY c.embedding <=> $1::vector) AS vrank
          FROM interview_chunks c
          JOIN interviews i ON i.id = c."interviewId"
          WHERE c."tenantId" = $2 AND i."projectId" = $3
            AND c.embedding IS NOT NULL
          ORDER BY c.embedding <=> $1::vector
          LIMIT 30
        ),
        bm25_results AS (
          SELECT c.id, c.content, c."contextPrefix", c."topicSummary",
                 c."interviewId", c."speakerId", c."startTimeMs", c."endTimeMs",
                 ROW_NUMBER() OVER (
                   ORDER BY ts_rank_cd(c.tsv, plainto_tsquery('spanish', $4), 32) DESC
                 ) AS brank
          FROM interview_chunks c
          JOIN interviews i ON i.id = c."interviewId"
          WHERE c."tenantId" = $2 AND i."projectId" = $3
            AND c.tsv @@ plainto_tsquery('spanish', $4)
          ORDER BY ts_rank_cd(c.tsv, plainto_tsquery('spanish', $4), 32) DESC
          LIMIT 30
        ),
        fused AS (
          SELECT COALESCE(v.id, b.id) AS id,
                 COALESCE(v.content, b.content) AS content,
                 COALESCE(v."contextPrefix", b."contextPrefix") AS "contextPrefix",
                 COALESCE(v."topicSummary", b."topicSummary") AS "topicSummary",
                 COALESCE(v."interviewId", b."interviewId") AS "interviewId",
                 COALESCE(v."speakerId", b."speakerId") AS "speakerId",
                 COALESCE(v."startTimeMs", b."startTimeMs") AS "startTimeMs",
                 COALESCE(v."endTimeMs", b."endTimeMs") AS "endTimeMs",
                 COALESCE(1.0/(60 + v.vrank), 0) + COALESCE(1.0/(60 + b.brank), 0) AS "rrfScore"
          FROM vector_results v
          FULL OUTER JOIN bm25_results b ON v.id = b.id
        )
        SELECT * FROM fused ORDER BY "rrfScore" DESC LIMIT $5
        `,
        vector,
        tenantId,
        projectId,
        query,
        limit,
      );
    });

    return results;
  }

  /**
   * Search entities in the knowledge graph by semantic similarity.
   */
  async searchEntities(
    tenantId: string,
    projectId: string,
    query: string,
    type?: string,
    limit = 20,
  ): Promise<EntitySearchResult[]> {
    const queryEmbedding = await this.generateQueryEmbedding(query, tenantId);
    const vector = this.formatVector(queryEmbedding);

    // Validate type against allowed enum values to prevent injection
    const typeClause =
      type && VALID_ENTITY_TYPES.has(type)
        ? `AND e.type = '${type}'`
        : '';

    const results = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL hnsw.ef_search = 100`);

      return tx.$queryRawUnsafe<EntitySearchResult[]>(
        `
        SELECT e.id, e.type::text, e.name, e.description, e.metadata,
               e."projectId",
               1 - (e.embedding <=> $1::vector) AS similarity
        FROM org_entities e
        WHERE e."tenantId" = $2
          AND e."projectId" = $3
          AND e."deletedAt" IS NULL
          AND e.embedding IS NOT NULL
          ${typeClause}
        ORDER BY e.embedding <=> $1::vector
        LIMIT $4
        `,
        vector,
        tenantId,
        projectId,
        limit,
      );
    });

    return results;
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

  private async generateQueryEmbedding(
    query: string,
    tenantId: string,
  ): Promise<number[]> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(tenantId);
    if (!apiKey) {
      throw new Error(
        `No OpenAI API key configured for tenant ${tenantId}`,
      );
    }

    const openai = this.getOpenAIClient(apiKey);
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0].embedding;
  }
}
