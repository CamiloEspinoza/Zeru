import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LinkedInApiService } from './linkedin-api.service';
import { GeminiImageService } from './gemini-image.service';
import { SkillsService } from '../../ai/services/skills.service';

const LINKEDIN_COPYWRITING_SKILL_CONTENT = `# LinkedIn Copywriting Expert Skill

Eres un experto en copywriting para LinkedIn con años de experiencia creando contenido viral y de alto engagement.

## Fórmulas de Hook (primera línea)

La primera línea es lo más importante. Debe generar curiosidad o contrariedad:

### Patrones efectivos:
- **Pregunta provocadora**: "¿Por qué el 90% de los profesionales fracasan en LinkedIn?"
- **Estadística sorprendente**: "Publiqué 365 días seguidos en LinkedIn. Aprendí esto:"
- **Afirmación contraintuitiva**: "Tener 10.000 seguidores no sirve de nada."
- **Historia personal**: "Hace 2 años perdí mi trabajo. Hoy tengo 50.000 seguidores."
- **Confesión**: "Cometí este error durante 3 años. No lo repitas."
- **Número específico**: "7 errores que te costaron clientes esta semana:"

## Estructura de post ganador

\`\`\`
[HOOK - Primera línea irresistible]

[Espacio en blanco]

[Desarrollo - Una idea por párrafo]
[Mantén párrafos cortos (1-2 líneas)]
[Usa listas cuando sea apropiado]

[Espacio en blanco]

[Cierre - Insight o lección clave]

[CTA - Pregunta para comentarios]

[Hashtags: 3-5, al final]
\`\`\`

## Formatos por pilar de contenido

### Thought Leadership (2x/semana)
- Perspectiva única sobre una tendencia
- Desafía el status quo con argumentos sólidos
- Comparte tu visión del futuro de la industria

### Tips y Tutoriales (2x/semana)
- "X pasos para hacer Y"
- Contenido accionable inmediatamente
- Incluye ejemplos específicos

### Case Studies (1x/semana)
- Situación → Problema → Solución → Resultado
- Usa números reales cuando sea posible
- Termina con la lección aprendida

### Industry News (1x/semana)
- Resume la noticia en una frase
- Añade tu perspectiva única
- Conecta con impacto para tu audiencia

### Behind the Scenes (1x/semana)
- Muestra el proceso real
- Sé vulnerable y auténtico
- Humaniza la marca

## Reglas de formato en LinkedIn

1. **Saltos de línea frecuentes**: Una idea por línea
2. **Sin párrafos largos**: Máximo 2-3 líneas seguidas
3. **Emojis con moderación**: Úsalos para estructurar, no decorar
4. **Negritas**: Solo para puntos clave (en HTML: no disponible, usar MAYÚSCULAS)
5. **Longitud ideal**: 150-300 palabras para texto
6. **Hashtags**: 3-5, específicos y relevantes

## Estrategia de hashtags

- 1 hashtag amplio (#marketing, #liderazgo)
- 1-2 hashtags de nicho (#contentmarketing, #b2bmarketing)
- 1 hashtag de marca personal (si aplica)

## Calls to Action efectivos

- "¿Cuál es tu experiencia con esto? Cuéntame en los comentarios."
- "¿Estás de acuerdo? ¿O ves algo diferente?"
- "Guarda este post para cuando lo necesites."
- "Comparte si conoces a alguien que necesite verlo."
- "¿Cuál agregarías tú?"

## Tipos de contenido visual (para Gemini)

Para posts con imagen, usa prompts que incluyan:
- Estilo: minimalista, profesional, editorial, flat design
- Composición: texto grande, fondo limpio, colores de marca
- Evitar: banco de imágenes clichés, fotos de apretón de manos
- Preferir: infografías simples, citas visuales, datos visualizados
`;


export interface CreatePostInput {
  content: string;
  mediaType?: string;
  mediaUrl?: string;
  imageS3Key?: string;
  status?: string;
  scheduledAt?: Date | null;
  contentPillar?: string;
  visibility?: string;
  conversationId?: string;
}

export interface BulkScheduleItem {
  content: string;
  scheduledAt: string;
  contentPillar?: string;
  mediaType?: string;
  visibility?: string;
}

export interface ListPostsFilters {
  status?: string;
  from?: string;
  to?: string;
  contentPillar?: string;
  page?: number;
  perPage?: number;
}

@Injectable()
export class LinkedInPostsService {
  private readonly logger = new Logger(LinkedInPostsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly apiService: LinkedInApiService,
    private readonly geminiService: GeminiImageService,
    private readonly skillsService: SkillsService,
  ) {}

  async create(tenantId: string, input: CreatePostInput) {
    return this.prisma.linkedInPost.create({
      data: {
        tenantId,
        content: input.content,
        mediaType: input.mediaType ?? 'NONE',
        mediaUrl: input.mediaUrl ?? null,
        imageS3Key: input.imageS3Key ?? null,
        status: input.status ?? 'DRAFT',
        scheduledAt: input.scheduledAt ?? null,
        contentPillar: input.contentPillar ?? null,
        visibility: input.visibility ?? 'PUBLIC',
        conversationId: input.conversationId ?? null,
      },
    });
  }

  async bulkSchedule(tenantId: string, posts: BulkScheduleItem[], conversationId?: string) {
    const created = await this.prisma.$transaction(
      posts.map((p) =>
        this.prisma.linkedInPost.create({
          data: {
            tenantId,
            content: p.content,
            mediaType: p.mediaType ?? 'NONE',
            status: 'SCHEDULED',
            scheduledAt: new Date(p.scheduledAt),
            contentPillar: p.contentPillar ?? null,
            visibility: p.visibility ?? 'PUBLIC',
            conversationId: conversationId ?? null,
          },
        }),
      ),
    );
    return created;
  }

  private async processCommentaryMentions(tenantId: string, commentary: string): Promise<string> {
    const urlMentionPattern = /@\[(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9\-_%]+)\]/g;

    let processed = commentary;
    const matches = [...commentary.matchAll(urlMentionPattern)];

    for (const match of matches) {
      const fullMatch = match[0];
      const vanityName = decodeURIComponent(match[1]);

      const person = await this.apiService.resolvePersonByVanityUrl(tenantId, vanityName);
      if (person) {
        const displayName = `${person.firstName} ${person.lastName}`.trim();
        processed = processed.replace(fullMatch, `@[${displayName}](${person.personUrn})`);
      } else {
        processed = processed.replace(fullMatch, vanityName);
      }
    }

    return processed;
  }

  async publish(tenantId: string, postId: string): Promise<void> {
    const post = await this.prisma.linkedInPost.findFirst({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException('Post no encontrado');
    if (post.status === 'PUBLISHED') return;

    try {
      const processedContent = await this.processCommentaryMentions(tenantId, post.content);
      let result: { postId: string | null };

      if (post.mediaType === 'IMAGE' && post.imageS3Key) {
        const imageUrn = await this.uploadImageFromS3(tenantId, post.imageS3Key, post.mediaUrl);
        result = await this.apiService.createImagePost(tenantId, processedContent, imageUrn, post.visibility);
      } else if (post.mediaType === 'ARTICLE' && post.mediaUrl) {
        result = await this.apiService.createArticlePost(tenantId, processedContent, post.mediaUrl, 'Artículo', undefined, post.visibility);
      } else {
        result = await this.apiService.createTextPost(tenantId, processedContent, post.visibility);
      }

      await this.prisma.linkedInPost.update({
        where: { id: postId },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          linkedinPostId: result.postId ?? null,
          errorMessage: null,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      await this.prisma.linkedInPost.update({
        where: { id: postId },
        data: { status: 'FAILED', errorMessage },
      });
      throw err;
    }
  }

  private async uploadImageFromS3(tenantId: string, s3Key: string, _mediaUrl?: string | null): Promise<string> {
    const { GetObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
    const { ConfigService } = await import('@nestjs/config');

    // Re-download from S3 (we have credentials in env)
    const client = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      },
    });

    const bucket = process.env.AWS_S3_BUCKET ?? 'zeru-dev';
    const cmd = new GetObjectCommand({ Bucket: bucket, Key: s3Key });
    const response = await client.send(cmd);
    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    client.destroy();

    return this.apiService.uploadImageToLinkedIn(tenantId, buffer, response.ContentType ?? 'image/png');
  }

  async cancel(tenantId: string, postId: string) {
    const post = await this.prisma.linkedInPost.findFirst({ where: { id: postId, tenantId } });
    if (!post) throw new NotFoundException('Post no encontrado');
    if (!['SCHEDULED', 'DRAFT', 'PENDING_APPROVAL'].includes(post.status)) {
      throw new BadRequestException(`No se puede cancelar un post en estado ${post.status}`);
    }
    return this.prisma.linkedInPost.update({
      where: { id: postId },
      data: { status: 'CANCELLED' },
    });
  }

  async list(tenantId: string, filters: ListPostsFilters = {}) {
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 20;
    const skip = (page - 1) * perPage;

    const where: Record<string, unknown> = { tenantId };
    if (filters.status) where.status = filters.status;
    if (filters.contentPillar) where.contentPillar = filters.contentPillar;
    if (filters.from || filters.to) {
      where.scheduledAt = {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    const [posts, total] = await Promise.all([
      this.prisma.linkedInPost.findMany({
        where,
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take: perPage,
      }),
      this.prisma.linkedInPost.count({ where }),
    ]);

    return { posts, total, page, perPage };
  }

  async getById(tenantId: string, postId: string) {
    const post = await this.prisma.linkedInPost.findFirst({
      where: { id: postId, tenantId },
    });
    if (!post) throw new NotFoundException('Post no encontrado');
    return post;
  }

  async getScheduledDue() {
    return this.prisma.linkedInPost.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, tenantId: true },
    });
  }

  async getOrCreateConfig(tenantId: string) {
    let config = await this.prisma.linkedInAgentConfig.findUnique({ where: { tenantId } });
    if (!config) {
      config = await this.prisma.linkedInAgentConfig.create({
        data: {
          tenantId,
          autoPublish: false,
          defaultVisibility: 'PUBLIC',
          contentPillars: ['thought-leadership', 'tips', 'case-study', 'industry-news', 'behind-the-scenes'],
        },
      });
      // Seed LinkedIn copywriting skill on first use
      try {
        await this.skillsService.installFromContent(tenantId, {
          name: 'LinkedIn Copywriting Expert',
          description: 'Expert LinkedIn copywriting: hooks, post formats, content pillars, hashtag strategy, and image prompt engineering for professional content.',
          repoUrl: 'zeru:builtin:linkedin-copywriting',
          content: LINKEDIN_COPYWRITING_SKILL_CONTENT,
          version: '1.0.0',
        });
      } catch (err) {
        this.logger.warn(`Could not seed LinkedIn copywriting skill: ${(err as Error).message}`);
      }
    }
    return config;
  }

  async updateConfig(tenantId: string, data: { autoPublish?: boolean; defaultVisibility?: string; contentPillars?: string[] }) {
    await this.getOrCreateConfig(tenantId);
    return this.prisma.linkedInAgentConfig.update({
      where: { tenantId },
      data: {
        ...(data.autoPublish !== undefined ? { autoPublish: data.autoPublish } : {}),
        ...(data.defaultVisibility ? { defaultVisibility: data.defaultVisibility } : {}),
        ...(data.contentPillars ? { contentPillars: data.contentPillars } : {}),
      },
    });
  }
}
