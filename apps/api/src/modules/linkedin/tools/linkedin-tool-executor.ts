import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MemoryService } from '../../ai/services/memory.service';
import { SkillsService } from '../../ai/services/skills.service';
import { LinkedInAuthService } from '../services/linkedin-auth.service';
import { LinkedInApiService } from '../services/linkedin-api.service';
import { LinkedInPostsService } from '../services/linkedin-posts.service';
import { GeminiImageService } from '../services/gemini-image.service';

export interface ToolExecutionResult {
  success: boolean;
  data: unknown;
  summary: string;
}

@Injectable()
export class LinkedInToolExecutor {
  private readonly logger = new Logger(LinkedInToolExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly memory: MemoryService,
    private readonly skills: SkillsService,
    private readonly authService: LinkedInAuthService,
    private readonly apiService: LinkedInApiService,
    private readonly postsService: LinkedInPostsService,
    private readonly geminiService: GeminiImageService,
  ) {}

  async execute(
    name: string,
    args: Record<string, unknown>,
    tenantId: string,
    userId?: string,
    options?: { conversationId?: string },
  ): Promise<ToolExecutionResult> {
    try {
      switch (name) {
        case 'create_linkedin_post':
          return await this.createPost(args, tenantId, options?.conversationId);

        case 'schedule_linkedin_post':
          return await this.schedulePost(args, tenantId, options?.conversationId);

        case 'bulk_schedule_posts':
          return await this.bulkSchedulePosts(args, tenantId, options?.conversationId);

        case 'bulk_create_drafts':
          return await this.bulkCreateDrafts(args, tenantId, options?.conversationId);

        case 'suggest_image_prompt':
          return await this.suggestImagePrompt(args, tenantId);

        case 'generate_image':
          return await this.generateImage(args, tenantId);

        case 'get_linkedin_connection_status':
          return await this.getConnectionStatus(tenantId);

        case 'get_post_history':
          return await this.getPostHistory(args, tenantId);

        case 'get_scheduled_posts':
          return await this.getScheduledPosts(args, tenantId);

        case 'cancel_scheduled_post':
          return await this.cancelPost(args, tenantId);

        case 'get_content_pillars':
          return await this.getContentPillars(tenantId);

        case 'ask_user_question':
          return { success: true, data: null, summary: 'Pregunta enviada al usuario' };

        case 'update_conversation_title':
          return { success: true, data: null, summary: 'Título actualizado' };

        case 'memory_store':
          return await this.storeMemory(args, tenantId, userId);

        case 'memory_search':
          return await this.searchMemory(args, tenantId, userId);

        case 'get_skill_reference':
          return await this.getSkillReference(args, tenantId);

        default:
          return { success: false, data: null, summary: `Herramienta desconocida: ${name}` };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Tool ${name} failed:`, error);
      return { success: false, data: { error: message }, summary: `Error: ${message}` };
    }
  }

  private async createPost(args: Record<string, unknown>, tenantId: string, conversationId?: string): Promise<ToolExecutionResult> {
    const config = await this.postsService.getOrCreateConfig(tenantId);

    const post = await this.postsService.create(tenantId, {
      content: String(args.content ?? ''),
      mediaType: String(args.media_type ?? 'NONE'),
      mediaUrl: args.media_url ? String(args.media_url) : undefined,
      imageS3Key: args.image_s3_key ? String(args.image_s3_key) : undefined,
      status: config.autoPublish ? 'SCHEDULED' : 'PENDING_APPROVAL',
      contentPillar: args.content_pillar ? String(args.content_pillar) : undefined,
      visibility: String(args.visibility ?? 'PUBLIC'),
      conversationId,
    });

    if (config.autoPublish) {
      await this.postsService.publish(tenantId, post.id);
      return {
        success: true,
        data: { ...post, status: 'PUBLISHED' },
        summary: 'Post publicado directamente en LinkedIn',
      };
    }

    return {
      success: true,
      data: post,
      summary: `Post creado y pendiente de aprobación (id: ${post.id})`,
    };
  }

  private async schedulePost(args: Record<string, unknown>, tenantId: string, conversationId?: string): Promise<ToolExecutionResult> {
    const post = await this.postsService.create(tenantId, {
      content: String(args.content ?? ''),
      mediaType: String(args.media_type ?? 'NONE'),
      mediaUrl: args.media_url ? String(args.media_url) : undefined,
      imageS3Key: args.image_s3_key ? String(args.image_s3_key) : undefined,
      status: 'SCHEDULED',
      scheduledAt: new Date(String(args.scheduled_at)),
      contentPillar: args.content_pillar ? String(args.content_pillar) : undefined,
      visibility: String(args.visibility ?? 'PUBLIC'),
      conversationId,
    });

    return {
      success: true,
      data: post,
      summary: `Post programado para ${new Date(String(args.scheduled_at)).toLocaleString('es-CL')}`,
    };
  }

  private async bulkSchedulePosts(args: Record<string, unknown>, tenantId: string, conversationId?: string): Promise<ToolExecutionResult> {
    const postsInput = (args.posts as Array<{
      content: string;
      scheduled_at: string;
      content_pillar?: string | null;
      visibility?: string;
    }>) ?? [];

    const created = await this.postsService.bulkSchedule(
      tenantId,
      postsInput.map((p) => ({
        content: p.content,
        scheduledAt: p.scheduled_at,
        contentPillar: p.content_pillar ?? undefined,
        visibility: p.visibility ?? 'PUBLIC',
      })),
      conversationId,
    );

    return {
      success: true,
      data: { count: created.length, posts: created.map((p) => ({ id: p.id, scheduledAt: p.scheduledAt, contentPillar: p.contentPillar })) },
      summary: `${created.length} posts programados en el calendario de contenido`,
    };
  }

  private async bulkCreateDrafts(args: Record<string, unknown>, tenantId: string, conversationId?: string): Promise<ToolExecutionResult> {
    const postsInput = (args.posts as Array<{
      content: string;
      scheduled_at: string;
      content_pillar?: string | null;
      visibility?: string;
      image_prompt?: string | null;
      media_type?: string;
      image_s3_key?: string | null;
      media_url?: string | null;
    }>) ?? [];

    const created = await this.postsService.bulkCreateDrafts(
      tenantId,
      postsInput.map((p) => ({
        content: p.content,
        scheduledAt: p.scheduled_at,
        contentPillar: p.content_pillar ?? undefined,
        visibility: p.visibility ?? 'PUBLIC',
        imagePrompt: p.image_prompt ?? undefined,
        mediaType: p.media_type ?? 'NONE',
        imageS3Key: p.image_s3_key ?? undefined,
        mediaUrl: p.media_url ?? undefined,
      })),
      conversationId,
    );

    return {
      success: true,
      data: {
        count: created.length,
        posts: created.map((p) => ({
          id: p.id,
          content: p.content,
          scheduledAt: p.scheduledAt,
          contentPillar: p.contentPillar,
          imagePrompt: p.imagePrompt,
          status: p.status,
        })),
      },
      summary: `${created.length} borradores creados para revisión`,
    };
  }

  private async suggestImagePrompt(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const postId = String(args.post_id ?? '');
    const prompt = String(args.prompt ?? '');

    const post = await this.postsService.updateImagePrompt(tenantId, postId, prompt);

    return {
      success: true,
      data: { postId: post.id, imagePrompt: prompt },
      summary: `Prompt de imagen sugerido para el post`,
    };
  }

  private async generateImage(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const prompt = String(args.prompt ?? '');
    const aspectRatio = String(args.aspect_ratio ?? '1:1');
    const model = (args.model === 'pro' ? 'pro' : 'flash') as 'flash' | 'pro';

    const result = await this.geminiService.generateImage(tenantId, prompt, aspectRatio, model);

    return {
      success: true,
      data: { s3Key: result.s3Key, imageUrl: result.s3Url, mimeType: result.mimeType },
      summary: `Imagen generada con Gemini ${model === 'pro' ? '3 Pro' : '3.1 Flash'} y guardada en S3 (${aspectRatio})`,
    };
  }

  private async getConnectionStatus(tenantId: string): Promise<ToolExecutionResult> {
    const connection = await this.authService.getConnection(tenantId);
    if (!connection) {
      return { success: true, data: { connected: false }, summary: 'LinkedIn no conectado' };
    }
    return {
      success: true,
      data: {
        connected: true,
        profileName: connection.profileName,
        personUrn: connection.personUrn,
        isExpired: connection.isExpired,
        expiresAt: connection.expiresAt,
      },
      summary: connection.isExpired ? 'LinkedIn conectado pero token expirado' : `LinkedIn conectado como ${connection.profileName ?? 'usuario desconocido'}`,
    };
  }

  private async getPostHistory(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const status = args.status ? String(args.status) : undefined;
    const limit = Math.min(Number(args.limit ?? 10), 50);

    const result = await this.postsService.list(tenantId, { status, perPage: limit });

    return {
      success: true,
      data: result,
      summary: `${result.total} posts encontrados`,
    };
  }

  private async getScheduledPosts(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const from = args.from ? String(args.from) : new Date().toISOString();
    const to = args.to ? String(args.to) : undefined;

    const result = await this.postsService.list(tenantId, { status: 'SCHEDULED', from, to, perPage: 50 });

    return {
      success: true,
      data: result,
      summary: `${result.total} posts programados`,
    };
  }

  private async cancelPost(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const post = await this.postsService.cancel(tenantId, String(args.post_id ?? ''));
    return {
      success: true,
      data: post,
      summary: `Post cancelado: "${String(post.content).slice(0, 50)}..."`,
    };
  }

  private async getContentPillars(tenantId: string): Promise<ToolExecutionResult> {
    const config = await this.postsService.getOrCreateConfig(tenantId);
    return {
      success: true,
      data: { contentPillars: config.contentPillars, autoPublish: config.autoPublish, defaultVisibility: config.defaultVisibility },
      summary: 'Configuración del agente de LinkedIn obtenida',
    };
  }

  private async storeMemory(args: Record<string, unknown>, tenantId: string, userId?: string): Promise<ToolExecutionResult> {
    await this.memory.store({
      tenantId,
      userId: args.scope === 'user' ? (userId ?? null) : null,
      content: String(args.content ?? ''),
      category: String(args.category ?? 'CONTEXT') as never,
      importance: Number(args.importance ?? 5),
      documentId: args.documentId ? String(args.documentId) : null,
    });
    return { success: true, data: null, summary: 'Memoria guardada' };
  }

  private async searchMemory(args: Record<string, unknown>, tenantId: string, userId?: string): Promise<ToolExecutionResult> {
    const results = await this.memory.search({
      tenantId,
      userId: (args.scope === 'user' || args.scope === 'all') ? (userId ?? null) : null,
      query: String(args.query ?? ''),
      limit: 10,
    });
    return { success: true, data: results, summary: `${results.length} memorias encontradas` };
  }

  private async getSkillReference(args: Record<string, unknown>, tenantId: string): Promise<ToolExecutionResult> {
    const content = await this.skills.getSkillReference(
      tenantId,
      String(args.skill_name ?? ''),
      String(args.file_path ?? ''),
    );
    if (!content) return { success: false, data: null, summary: 'Archivo no encontrado en el skill' };
    return { success: true, data: { content }, summary: 'Referencia del skill cargada' };
  }
}
