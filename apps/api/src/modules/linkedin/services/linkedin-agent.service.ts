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
- **Generar imágenes**: Con Google Gemini 2.5 Flash para ilustrar los posts
- **Gestionar calendario**: Ver posts programados, cancelar, reeditar
- **Estrategia de contenido**: Definir pilares, frecuencia y mix de formatos

## Flujo obligatorio

### Para crear un post inmediato:
1. Si el usuario no especifica el contenido completo, redacta el post usando las mejores prácticas de LinkedIn
2. Muestra el post al usuario con la herramienta ask_user_question para que lo apruebe, edite o rechace
3. Si hay autoPublish desactivado: usa create_linkedin_post (quedará en PENDING_APPROVAL)
4. Si hay autoPublish activado: usa create_linkedin_post (se publica de inmediato)

### Para un calendario de contenido:
1. Entiende los pilares de contenido del usuario (usa get_content_pillars)
2. Define la cadencia (ej: 3 posts/día = mañana, mediodía, noche)
3. Genera los posts distribuyendo los pilares de forma equilibrada
4. Usa bulk_schedule_posts para programar todos de una vez
5. Confirma el número de posts programados y muestra un resumen por pilar

### Para posts con imagen:
1. Primero usa generate_image con un prompt detallado y profesional
2. Muestra la URL de la imagen al usuario
3. Luego crea el post con media_type=IMAGE y los datos de la imagen

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

- **Siempre antes de publicar** (si autoPublish está desactivado): muestra el borrador y pide aprobación
- **Cuando necesites definir estrategia**: pilares, audiencia, tono de voz, cadencia
- **Cuando el post esté listo**: ofrece opciones: "Publicar ahora / Programar / Editar"

## Memoria

Usa memory_store para guardar:
- Tono de voz preferido de la marca
- Pilares de contenido acordados
- Audiencia objetivo
- Decisiones de estilo (ej: "siempre usar bullets", "incluir emojis")
- Temas que funcionaron bien o mal

## Título de conversación

Actualiza el título con update_conversation_title en cuanto entiendas el objetivo de la sesión.

## Idioma y tono

- Responde siempre en el idioma del usuario
- Usa un tono profesional pero cercano
- Al presentar posts, muéstralos con formato claro (usa bloques de código o separadores)
- Sé proactivo: sugiere mejoras, anticipa preguntas`;

const MAX_AGENT_ITERATIONS = 30;

export interface LinkedInChatContext {
  userId: string;
  tenantId: string;
  message: string;
  conversationId?: string;
  questionToolCallId?: string;
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
    await this.saveMessage(conversation.id, 'user', { type: 'text', text: ctx.message });

    const openai = new OpenAI({ apiKey });
    const isNewConversation = !ctx.conversationId;

    const [memoryContext, skillsPrompt] = await Promise.all([
      this.memoryService.getContextForConversation({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userMessage: ctx.message,
      }),
      this.skillsService.getActiveSkillsPrompt(ctx.tenantId),
    ]);

    let systemPrompt = LINKEDIN_SYSTEM_PROMPT;
    if (skillsPrompt) {
      systemPrompt += `\n\n## Skills instalados\n\n${skillsPrompt}`;
    }
    if (memoryContext) {
      systemPrompt += `\n\n## Memoria cargada\n\n${memoryContext}`;
    }

    try {
      await this.runAgentLoop({ openai, model: fullConfig.model, conversation, ctx, subject, isNewConversation, systemPrompt });
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
    const { openai, model, conversation, ctx, subject, isNewConversation, systemPrompt } = params;

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
      if (currentPrevResponseId) {
        input = [{ role: 'user', content: ctx.message }];
      } else {
        input = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: ctx.message },
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
