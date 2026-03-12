import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { Subject } from 'rxjs';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiConfigService } from '../../ai/services/ai-config.service';
import { MemoryService } from '../../ai/services/memory.service';
import { SkillsService } from '../../ai/services/skills.service';
import { ActiveStreamsRegistry } from '../../ai/services/active-streams.registry';
import { LinkedInToolExecutor } from '../tools/linkedin-tool-executor';
import { LINKEDIN_TOOLS, LINKEDIN_TOOL_LABELS } from '../tools/linkedin-tools';
import type { ChatEvent, QuestionPayload } from '@zeru/shared';

const LINKEDIN_SYSTEM_PROMPT = `Eres un agente especializado en contenido de LinkedIn. Tu misión es ayudar a crear, programar y publicar contenido de valor en LinkedIn que construya autoridad profesional, genere engagement y atraiga oportunidades de negocio.

## Tu rol

Eres un estratega de contenido y copywriter experto en LinkedIn. Conoces los algoritmos de la plataforma, los formatos que mejor funcionan, y cómo estructurar mensajes que conecten con una audiencia profesional.

## Capacidades

- **Crear posts**: Texto, con imágenes (generadas por Gemini) o con artículos/URLs
- **Programar publicaciones**: Una a la vez o calendarios completos de 30, 60, 90 días
- **Sugerir prompts de imagen**: Sugieres prompts para generar imágenes, pero el usuario decide cuándo generarlas desde la tarjeta del post
- **Gestionar calendario**: Ver posts programados, cancelar, reeditar
- **Estrategia de contenido**: Definir pilares, frecuencia y mix de formatos

## REGLA CRÍTICA: Contenido primero, imágenes después

**NUNCA generes imágenes automáticamente.** El flujo correcto es siempre:
1. Crea el texto del post PRIMERO con create_linkedin_post (sin imagen, media_type=NONE)
2. Si el post podría beneficiarse de una imagen, usa suggest_image_prompt para sugerir un prompt de imagen
3. El usuario decidirá desde la tarjeta del post si quiere generar la imagen, editarla, o subir una propia
4. **NUNCA uses generate_image directamente** — la generación la dispara el usuario desde la interfaz

## Flujo obligatorio

### Cuando el usuario pide MÚLTIPLES posts o un calendario de contenido:

**ANTES de crear cualquier contenido**, DEBES hacer preguntas estratégicas usando ask_user_question. Esto es OBLIGATORIO. Pregunta:

1. **Audiencia**: "¿A quién va dirigido este contenido? (ej: directores de tecnología, emprendedores, profesionales de marketing)"
2. **Tono**: "¿Qué tono prefieres para tus publicaciones?" — opciones: Profesional y formal / Cercano y conversacional / Provocador y disruptivo / Educativo y didáctico
3. **Pilares**: Primero revisa con get_content_pillars si ya hay pilares configurados. Si no los hay, pregunta: "¿Sobre qué temas principales quieres publicar?"
4. **Frecuencia**: "¿Con qué frecuencia quieres publicar?" — opciones: Diario / 3 veces por semana / Semanal / Personalizado
5. **Temas específicos**: "¿Hay temas puntuales, lanzamientos, o eventos que quieras incluir en el calendario?"

Puedes combinar varias preguntas en una sola llamada a ask_user_question si tiene sentido. Guarda las respuestas en memoria con memory_store.

### Para crear un solo post:
1. Si el usuario no especifica el contenido completo, redacta el post usando las mejores prácticas de LinkedIn
2. Usa create_linkedin_post con media_type=NONE para crear el borrador
3. Si el post necesita imagen, usa suggest_image_prompt para sugerir un prompt
4. El post queda como DRAFT para que el usuario lo revise, apruebe y programe desde la tarjeta

### Para crear múltiples posts (calendario):
1. PRIMERO haz las preguntas estratégicas (ver arriba) — ESTO ES OBLIGATORIO
2. Usa bulk_create_drafts para crear todos los textos como borradores (status DRAFT)
3. Para cada post que necesite imagen, usa suggest_image_prompt
4. Los posts aparecerán en un carrusel donde el usuario puede revisar, editar, aprobar y programar cada uno individualmente
5. **NO uses bulk_schedule_posts** — los posts deben crearse como DRAFT para revisión

### Para posts con imágenes subidas por el usuario:
1. Cuando el usuario adjunte imágenes, las verás visualmente Y recibirás sus s3_key/url en el mensaje.
2. Analiza el contenido visual de cada imagen para incorporarlo en el texto del post.
3. **NUNCA uses generate_image ni suggest_image_prompt** cuando el usuario proporcionó imágenes.
4. Decide la estructura de posts basándote en las imágenes:
   - Si hay una sola imagen → crea un solo post con create_linkedin_post (media_type=IMAGE, image_s3_key, media_url).
   - Si hay varias imágenes del mismo tema/evento → crea posts individuales, cada uno con la imagen más relevante.
   - Si hay varias imágenes de temas distintos → crea un post separado por cada imagen/tema.
5. Para un solo post: usa create_linkedin_post con media_type=IMAGE, image_s3_key y media_url del mensaje.
6. Para múltiples posts: usa bulk_create_drafts con media_type=IMAGE, image_s3_key y media_url en cada item que tenga imagen.
7. Describe en el texto del post lo que ves en la imagen cuando sea relevante (insight, dato, contexto visual).

## Mejores prácticas de LinkedIn que debes aplicar

### Estructura del post ganador:
- **Hook (línea 1)**: La primera línea debe ser irresistible — pregunta polémica, estadística sorprendente, afirmación contraintuitiva, o inicio de una historia. Sin el hook, nadie hace clic en "ver más".
- **Cuerpo**: Desarrolla la idea con claridad. Usa saltos de línea frecuentes (una idea por línea). Evita párrafos largos.
- **CTA final**: Termina con una pregunta o llamado a la acción claro (comentar, compartir, conectar).
- **Hashtags**: 3-5 hashtags relevantes al final, no dentro del texto.

### Formatos que funcionan en LinkedIn:
- **Historia personal**: "Hace 3 años cometí este error…" → lección aprendida
- **Lista de valor**: "5 cosas que nadie te dice sobre X"
- **Perspectiva contraria**: "La mayoría piensa X. Yo pienso Y. Aquí está mi razonamiento."
- **Insight de datos**: "El 73% de los profesionales hace X. Pero los mejores hacen Y."
- **Detrás del escenario**: Procesos internos, decisiones difíciles, aprendizajes reales
- **Celebración**: Logros del equipo, hitos alcanzados (con autenticidad)

### Pilares de contenido típicos:
- **Thought Leadership**: Perspectivas únicas sobre tendencias de la industria
- **Tips y tutoriales**: Contenido práctico y aplicable de inmediato
- **Case Studies**: Casos reales de clientes o proyectos propios
- **Industria y noticias**: Análisis de noticias relevantes
- **Detrás del escenario**: La historia humana de la empresa/persona

## Cuándo usar ask_user_question

- **SIEMPRE antes de crear múltiples posts**: preguntas estratégicas (audiencia, tono, pilares, frecuencia)
- **Cuando necesites definir estrategia**: pilares, audiencia, tono de voz, cadencia
- **Cuando haya ambigüedad**: si el usuario no es claro sobre qué quiere

## Memoria

Usa memory_store para guardar:
- Tono de voz preferido de la marca
- Pilares de contenido acordados
- Audiencia objetivo
- Decisiones de estilo (ej: "siempre usar bullets", "incluir emojis")
- Temas que funcionaron bien o mal
- Respuestas a preguntas estratégicas

## Título de conversación

**En conversaciones nuevas: llama a update_conversation_title como tu PRIMERA herramienta, antes de cualquier otra.** Con solo leer el mensaje del usuario tienes suficiente contexto para generar un título descriptivo (máximo 6 palabras, sin comillas, en el mismo idioma del usuario). Actualízalo si el tema evoluciona.

## Idioma y tono

- Responde siempre en el idioma del usuario
- Usa un tono profesional pero cercano
- Al presentar posts, muéstralos con formato claro (usa bloques de código o separadores)
- Sé proactivo: sugiere mejoras, anticipa preguntas

## Idioma para prompts de imagen

{{IMAGE_PROMPT_LANGUAGE_INSTRUCTION}}`;

const MAX_AGENT_ITERATIONS = 30;

export interface LinkedInChatContext {
  userId: string;
  tenantId: string;
  message: string;
  conversationId?: string;
  questionToolCallId?: string;
  uploadedImages?: Array<{ s3Key: string; imageUrl: string }>;
}

@Injectable()
export class LinkedInAgentService {
  private readonly logger = new Logger(LinkedInAgentService.name);

  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly toolExecutor: LinkedInToolExecutor,
    private readonly prisma: PrismaService,
    private readonly memoryService: MemoryService,
    private readonly activeStreams: ActiveStreamsRegistry,
    private readonly skillsService: SkillsService,
  ) {}

  async streamChat(ctx: LinkedInChatContext, subject: Subject<ChatEvent>): Promise<void> {
    const apiKey = await this.aiConfig.getDecryptedApiKey(ctx.tenantId);
    if (!apiKey) {
      subject.next({ type: 'error', message: 'Proveedor de IA no configurado' });
      subject.complete();
      return;
    }

    const fullConfig = await this.aiConfig.getFullConfig(ctx.tenantId);
    if (!fullConfig) {
      subject.next({ type: 'error', message: 'Configuración de IA no encontrada' });
      subject.complete();
      return;
    }

    const conversation = await this.ensureConversation(ctx);
    subject.next({ type: 'conversation_started', conversationId: conversation.id });
    this.activeStreams.register(conversation.id, subject);

    // Augment message with uploaded image context
    let effectiveMessage = ctx.message;
    if (ctx.uploadedImages?.length) {
      const imageList = ctx.uploadedImages
        .map((img, i) => `- Imagen ${i + 1}: s3_key: ${img.s3Key} | url: ${img.imageUrl}`)
        .join('\n');
      effectiveMessage = `${ctx.message}\n\n[IMÁGENES ADJUNTAS PARA EL POST — úsalas directamente sin llamar a generate_image ni suggest_image_prompt]\n${imageList}`;
    }

    await this.saveMessage(conversation.id, 'user', { type: 'text', text: ctx.message });

    const openai = new OpenAI({ apiKey });
    const isNewConversation = !ctx.conversationId;

    const [memoryContext, skillsPrompt, linkedInConfig] = await Promise.all([
      this.memoryService.getContextForConversation({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userMessage: ctx.message,
      }),
      this.skillsService.getActiveSkillsPrompt(ctx.tenantId),
      this.prisma.linkedInAgentConfig.findUnique({ where: { tenantId: ctx.tenantId }, select: { preferredLanguage: true } }),
    ]);

    const preferredLanguage = linkedInConfig?.preferredLanguage ?? 'es';
    const languageNames: Record<string, string> = {
      es: 'español',
      en: 'English',
      pt: 'português',
      fr: 'français',
      de: 'Deutsch',
      it: 'italiano',
    };
    const langLabel = languageNames[preferredLanguage] ?? preferredLanguage;
    const imageLangInstruction = `Los prompts de imagen que generes con suggest_image_prompt SIEMPRE deben estar escritos en ${langLabel} (código: "${preferredLanguage}"), independientemente del idioma en que el usuario escriba o del idioma del post.`;

    let systemPrompt = LINKEDIN_SYSTEM_PROMPT.replace('{{IMAGE_PROMPT_LANGUAGE_INSTRUCTION}}', imageLangInstruction);
    if (skillsPrompt) {
      systemPrompt += `\n\n## Skills instalados\n\n${skillsPrompt}`;
    }
    if (memoryContext) {
      systemPrompt += `\n\n## Memoria cargada\n\n${memoryContext}`;
    }

    try {
      await this.runAgentLoop({ openai, model: fullConfig.model, conversation, ctx: { ...ctx, message: effectiveMessage }, subject, isNewConversation, systemPrompt });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      subject.next({ type: 'error', message });
    } finally {
      this.activeStreams.unregister(conversation.id);
      subject.complete();
    }
  }

  private async runAgentLoop(params: {
    openai: OpenAI;
    model: string;
    conversation: {
      id: string;
      lastResponseId: string | null;
      parentResponseId: string | null;
      lastResponseOutput: import('@prisma/client').Prisma.JsonValue;
      pendingToolOutputs: import('@prisma/client').Prisma.JsonValue;
    };
    ctx: LinkedInChatContext;
    subject: Subject<ChatEvent>;
    isNewConversation: boolean;
    systemPrompt: string;
  }) {
    const { openai, model, conversation, ctx, subject, systemPrompt } = params;

    let input: OpenAI.Responses.ResponseInput;
    let currentPrevResponseId = conversation.lastResponseId ?? undefined;

    if (ctx.questionToolCallId) {
      const pendingOutputs = (conversation.pendingToolOutputs ?? []) as Array<{
        type: string;
        call_id: string;
        output: string;
      }>;

      input = [
        ...pendingOutputs.map(
          (o) => ({ type: 'function_call_output', call_id: o.call_id, output: o.output }) as OpenAI.Responses.ResponseInputItem.FunctionCallOutput,
        ),
        {
          type: 'function_call_output',
          call_id: ctx.questionToolCallId,
          output: JSON.stringify({ answer: ctx.message }),
        } as OpenAI.Responses.ResponseInputItem.FunctionCallOutput,
      ];

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { pendingToolOutputs: [] },
      });
    } else {
      // Build multimodal content when images are present
      const userContent = this.buildUserContent(ctx.message, ctx.uploadedImages);
      if (currentPrevResponseId) {
        input = [{ role: 'user', content: userContent }];
      } else {
        input = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ];
      }
    }

    for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
      let assistantText = '';
      let completedResponseId = '';
      let completedResponseOutput: Array<Record<string, unknown>> = [];
      let completedUsage = { inputTokens: 0, outputTokens: 0 };
      let hasQuestion = false;
      let thinkingText = '';
      const parentResponseIdForThisCall = currentPrevResponseId;
      const toolCallOutputs: Array<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> = [];

      const stream = openai.responses.stream({
        model,
        input,
        store: true,
        tools: LINKEDIN_TOOLS as OpenAI.Responses.Tool[],
        tool_choice: 'auto',
        reasoning: { effort: 'medium', summary: 'auto' },
        ...(currentPrevResponseId ? { previous_response_id: currentPrevResponseId } : {}),
      } as Parameters<typeof openai.responses.stream>[0]);

      for await (const event of stream) {
        const ev = event as unknown as Record<string, unknown>;
        const evType = ev['type'] as string;

        if (evType === 'response.reasoning_summary_text.delta') {
          const delta = String(ev['delta'] ?? '');
          thinkingText += delta;
          subject.next({ type: 'thinking', delta });
          continue;
        }
        if (evType === 'response.reasoning_text.delta') continue;

        if (evType === 'response.output_text.delta') {
          const delta = String(ev['delta'] ?? '');
          subject.next({ type: 'text_delta', delta });
          assistantText += delta;
          continue;
        }

        if (evType === 'response.output_item.added') {
          const item = ev['item'] as Record<string, unknown> | undefined;
          if (item?.['type'] === 'function_call') {
            const toolCallId = String(item['id'] ?? '');
            const toolName = String(item['name'] ?? '');
            subject.next({
              type: 'tool_start',
              toolCallId,
              name: toolName,
              args: {},
              label: LINKEDIN_TOOL_LABELS[toolName] ?? toolName,
            });
          }
          continue;
        }

        if (evType === 'response.output_item.done') {
          const item = ev['item'] as Record<string, unknown> | undefined;
          if (item?.['type'] !== 'function_call') continue;

          const itemId = String(item['id'] ?? '');
          const callId = String(item['call_id'] ?? itemId);
          const toolName = String(item['name'] ?? '');
          const argsStr = String(item['arguments'] ?? '{}');
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(argsStr); } catch { args = {}; }

          subject.next({
            type: 'tool_start',
            toolCallId: itemId,
            name: toolName,
            args,
            label: LINKEDIN_TOOL_LABELS[toolName] ?? toolName,
          });

          if (toolName === 'ask_user_question') {
            hasQuestion = true;
            const payload = args as unknown as QuestionPayload;
            subject.next({ type: 'question', toolCallId: callId, payload, conversationId: conversation.id });
            await this.saveMessage(conversation.id, 'question', { type: 'question', payload, callId });
            subject.next({
              type: 'tool_done',
              toolCallId: itemId,
              name: toolName,
              success: true,
              result: null,
              summary: 'Esperando respuesta del usuario',
            });
          } else if (toolName === 'update_conversation_title') {
            const newTitle = String(args.title ?? '').trim();
            if (newTitle) {
              await this.prisma.conversation.update({
                where: { id: conversation.id },
                data: { title: newTitle },
              });
              subject.next({ type: 'title_update', title: newTitle });
            }
            subject.next({
              type: 'tool_done',
              toolCallId: itemId,
              name: toolName,
              success: true,
              result: { title: newTitle },
              summary: `Título actualizado: "${newTitle}"`,
            });
            toolCallOutputs.push({
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify({ success: true, title: newTitle }),
            } as OpenAI.Responses.ResponseInputItem.FunctionCallOutput);
          } else {
            const result = await this.toolExecutor.execute(toolName, args, ctx.tenantId, ctx.userId, {
              conversationId: conversation.id,
            });
            subject.next({
              type: 'tool_done',
              toolCallId: itemId,
              name: toolName,
              success: result.success,
              result: result.data,
              summary: result.summary,
            });
            await this.saveMessage(conversation.id, 'tool', null, {
              toolName,
              toolArgs: args,
              toolResult: result.data,
            });
            toolCallOutputs.push({
              type: 'function_call_output',
              call_id: callId,
              output: JSON.stringify(result.data ?? {}),
            } as OpenAI.Responses.ResponseInputItem.FunctionCallOutput);
          }
          continue;
        }

        if (evType === 'response.completed') {
          const response = ev['response'] as Record<string, unknown> | undefined;
          completedResponseId = String(response?.['id'] ?? '');
          const usageRaw = response?.['usage'] as Record<string, unknown> | undefined;
          completedUsage = {
            inputTokens: Number(usageRaw?.['input_tokens'] ?? 0),
            outputTokens: Number(usageRaw?.['output_tokens'] ?? 0),
          };
          completedResponseOutput = (response?.['output'] as Array<Record<string, unknown>>) ?? [];
        }
      }

      if (thinkingText) {
        await this.saveMessage(conversation.id, 'assistant', { type: 'thinking', text: thinkingText });
      }
      if (assistantText) {
        await this.saveMessage(conversation.id, 'assistant', { type: 'text', text: assistantText });
      }

      currentPrevResponseId = completedResponseId;

      if (hasQuestion) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            lastResponseId: completedResponseId,
            parentResponseId: parentResponseIdForThisCall ?? null,
            lastResponseOutput: completedResponseOutput.length
              ? (completedResponseOutput as unknown as import('@prisma/client').Prisma.JsonArray)
              : [],
            pendingToolOutputs: toolCallOutputs.length
              ? (toolCallOutputs as unknown as import('@prisma/client').Prisma.JsonArray)
              : [],
          },
        });
        break;
      }

      if (toolCallOutputs.length > 0) {
        input = toolCallOutputs;
        continue;
      }

      subject.next({
        type: 'done',
        responseId: completedResponseId,
        conversationId: conversation.id,
        usage: completedUsage,
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastResponseId: completedResponseId },
      });

      break;
    }
  }

  private async ensureConversation(ctx: LinkedInChatContext) {
    if (ctx.conversationId) {
      const existing = await this.prisma.conversation.findFirst({
        where: { id: ctx.conversationId, userId: ctx.userId, tenantId: ctx.tenantId },
        select: { id: true, lastResponseId: true, parentResponseId: true, lastResponseOutput: true, pendingToolOutputs: true },
      });
      if (existing) return existing;
    }

    return this.prisma.conversation.create({
      data: { userId: ctx.userId, tenantId: ctx.tenantId, title: 'Agente LinkedIn', agentType: 'LINKEDIN' },
      select: { id: true, lastResponseId: true, parentResponseId: true, lastResponseOutput: true, pendingToolOutputs: true },
    });
  }

  private async saveMessage(
    conversationId: string,
    role: 'user' | 'assistant' | 'tool' | 'question',
    content: unknown,
    extras?: { toolName?: string; toolArgs?: unknown; toolResult?: unknown },
  ) {
    await this.prisma.message.create({
      data: {
        conversationId,
        role,
        content: (content ?? null) as never,
        toolName: extras?.toolName ?? null,
        toolArgs: (extras?.toolArgs ?? null) as never,
        toolResult: (extras?.toolResult ?? null) as never,
      },
    });
  }

  private buildUserContent(
    text: string,
    uploadedImages?: Array<{ s3Key: string; imageUrl: string }>,
  ): string | OpenAI.Responses.ResponseInputContent[] {
    if (!uploadedImages?.length) return text;

    const parts: OpenAI.Responses.ResponseInputContent[] = [
      { type: 'input_text', text } as OpenAI.Responses.ResponseInputText,
    ];

    for (const img of uploadedImages) {
      if (img.imageUrl) {
        parts.push({
          type: 'input_image',
          image_url: img.imageUrl,
          detail: 'auto',
        } as OpenAI.Responses.ResponseInputImage);
      }
    }

    return parts;
  }

  async getConversations(userId: string, tenantId: string) {
    return this.prisma.conversation.findMany({
      where: { userId, tenantId, agentType: 'LINKEDIN' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getMessages(conversationId: string, userId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId, agentType: 'LINKEDIN' },
    });
    if (!conversation) return null;
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteConversation(conversationId: string, userId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId, agentType: 'LINKEDIN' },
    });
    if (!conversation) return null;
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }
}
