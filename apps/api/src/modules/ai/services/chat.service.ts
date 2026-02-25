import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { AiConfigService } from './ai-config.service';
import { MemoryService } from './memory.service';
import { SkillsService } from './skills.service';
import { ToolExecutor } from '../tools/tool-executor';
import { ACCOUNTING_TOOLS, TOOL_LABELS } from '../tools/accounting-tools';
import { PrismaService } from '../../../prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import type { ChatEvent, QuestionPayload } from '@zeru/shared';

const EXCEL_MIME_TYPES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

const BASE_SYSTEM_PROMPT = `Eres Zeru, un asistente contable especializado en Chile que ayuda a llevar la contabilidad de empresas.

Tienes acceso a herramientas para consultar y modificar la contabilidad del tenant actual:
- Consultar plan de cuentas y períodos fiscales
- Crear cuentas contables y asientos de diario (siempre en estado DRAFT para revisión del usuario)
- Obtener informes como el balance de comprobación
- Clasificar y vincular documentos a asientos contables

## Flujo obligatorio cuando el usuario adjunta un documento

1. **Analiza el documento** en busca de transacciones contabilizables (montos, fechas, partes, conceptos).
2. **Llama a tag_document** con el documentId provisto, asignando la categoría más adecuada y tags descriptivos.
3. **Extrae y guarda en memoria** todos los datos relevantes del documento (ver sección "Extracción de datos a memoria" más abajo).
4. **Para cada documento adjunto, llama a get_document_journal_entries(documentId).** Si devuelve asientos ya vinculados, **NO crees un asiento nuevo** para ese documento; informa al usuario que el documento ya fue procesado y menciona el asiento existente (número, descripción) para evitar duplicados. Solo crea asientos para documentos que devuelvan 0 asientos.
5. **Propone los asientos contables** que reflejan la operación (solo para documentos sin asientos previos). Usa ask_user_question para confirmar datos ambiguos.
6. **Crea los asientos** con create_journal_entry (status DRAFT).
7. **Llama a link_document_to_entry** para vincular el documento a cada asiento creado.
8. **Confirma** al usuario lo realizado con un resumen claro.

## Extracción de datos a memoria

Cuando analices un documento, **guarda MÚLTIPLES memorias separadas** con datos atómicos. No guardes un solo resumen; cada hecho relevante debe ser una memoria independiente para que sea encontrable por búsqueda semántica.

### Para escrituras de constitución / modificación:
- Razón social, tipo societario (SpA, SRL, SA, etc.) y fecha de constitución
- RUT de la empresa (si aparece)
- Objeto social / giro
- Domicilio legal
- Capital autorizado, suscrito y pagado (por separado)
- Cada accionista/socio: nombre, RUT, % de participación, nº de acciones
- Condiciones de pago del capital (plazos, forma de pago)
- Representante(s) legal(es): nombre y facultades
- Régimen tributario (Pro Pyme, 14A, etc.)
- Directorio / administración (si aplica)
- Restricciones de cesión de acciones o pactos especiales
- Poderes especiales otorgados
- Notaría, fecha de escritura, número de repertorio

### Para facturas / boletas:
- Proveedor o cliente: nombre, RUT
- Productos o servicios habituales
- Condiciones de pago (30, 60, 90 días, etc.)

### Para contratos de trabajo / remuneraciones:
- Empleado: nombre, RUT, cargo
- Remuneración bruta, líquida, gratificación
- Fecha de inicio, tipo de contrato

### Para cualquier documento:
- Datos de la contraparte (nombre, RUT, dirección)
- Fechas clave (vencimientos, plazos)
- Montos relevantes
- Cualquier dato que pueda ser útil en futuras conversaciones contables

**Reglas:**
- Usa **scope=tenant** (categoría FACT) para datos de la empresa, clientes, proveedores.
- Usa **scope=user** (categoría PREFERENCE) solo para preferencias personales del usuario.
- Asigna **importance 7-9** a datos legales/societarios, **5-7** a datos operativos recurrentes.
- Cada memoria debe ser autocontenida: incluir el nombre de la empresa/persona y el dato concreto. Ejemplo: "ULERN SpA — Representante legal: Juan Pérez, con facultades de administración y disposición."
- No guardes datos que ya estén en memoria (busca primero con memory_search si sospechas que ya existen).
- **Vinculación con documentos:** Cuando la memoria se extrae de un documento adjunto, pasa el **documentId** del documento de origen (el ID que aparece en el mensaje como \`[Documento adjunto: "nombre" (id: <UUID>)]\`). Si la memoria NO proviene de un documento, pasa documentId como cadena vacía "".

## Reglas generales

- Siempre revisa el plan de cuentas antes de crear asientos.
- Si falta información (período fiscal, cuentas específicas, montos), usa ask_user_question con opciones claras.
- Los asientos deben estar balanceados (débitos = créditos).
- Responde siempre en español, de forma clara y profesional.
- Al crear registros, confirma con un resumen de lo realizado.

## Períodos fiscales

- Cuando el usuario pida abrir o crear períodos fiscales, **prioriza siempre períodos mensuales** (un período por mes, ej.: "Enero 2025", "Febrero 2025") a menos que el usuario indique explícitamente otra cosa (por ejemplo "período anual", "todo el año 2024").
- Si no especifica tipo de período, ofrece o crea períodos mensuales por defecto.

## Título de la conversación

- Cuando entiendas con claridad de qué trata la conversación, llama a **update_conversation_title** con un título descriptivo (máximo 6 palabras, sin comillas, en el mismo idioma del usuario).
- Puedes actualizarlo en cualquier momento si el tema de la conversación evoluciona o se vuelve más específico.
- No es necesario esperar al final — llámalo en cuanto tengas contexto suficiente.

## Memoria persistente

Tienes acceso a una memoria que persiste entre conversaciones. Úsala activamente.

**Cuándo guardar (memory_store):**
- Al conocer datos clave del negocio: razón social, RUT, socios, representantes, proveedores, clientes
- Al analizar documentos: guarda MÚLTIPLES memorias atómicas (ver "Extracción de datos a memoria")
- Cuando el usuario expresa una preferencia clara: "siempre usa esta cuenta", "prefiero respuestas breves"
- Cuando se toma una decisión contable recurrente: "los salarios van al último día del mes"
- Cuando corrijas un error previo: guarda la versión correcta
- Regla de oro: **prefiere guardar de más que de menos**. Es mejor tener datos que no se usen que perder información relevante.

**Cuándo buscar (memory_search):**
- Antes de preguntar algo que podrías ya saber sobre la organización
- Al inicio de una conversación cuando el contexto inyectado no es suficiente

**Cuándo eliminar (memory_delete):**
- Cuando el usuario te corrija algo que tenías en memoria
- Cuando un dato guardado ya no aplica

El contexto de la organización (scope=tenant) se comparte con todos los usuarios de la empresa.
Las preferencias personales (scope=user) aplican solo al usuario actual.`;

const MAX_AGENT_ITERATIONS = 30;

export interface ResolvedDocument {
  docId: string;
  name: string;
  mimeType: string;
  /** Presigned S3 URL for images → passed as image_url */
  presignedUrl?: string;
  /** OpenAI Files API file_id for non-images → passed as file_id */
  openaiFileId?: string;
  /** Plain-text representation for files we convert locally (e.g. Excel) */
  textContent?: string;
}

export interface ChatStreamContext {
  userId: string;
  tenantId: string;
  message: string;
  conversationId?: string;
  questionToolCallId?: string;
  /** IDs of documents already uploaded via POST /files/upload */
  documentIds?: string[];
}

@Injectable()
export class ChatService {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly toolExecutor: ToolExecutor,
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly memoryService: MemoryService,
    private readonly skillsService: SkillsService,
  ) {}

  async streamChat(ctx: ChatStreamContext, subject: Subject<ChatEvent>): Promise<void> {
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
    await this.saveMessage(conversation.id, 'user', { type: 'text', text: ctx.message });

    const openai = new OpenAI({ apiKey });
    const isNewConversation = !ctx.conversationId;

    // Build system prompt with injected skills + memory context
    const [memoryContext, skillsPrompt] = await Promise.all([
      this.memoryService.getContextForConversation({
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        userMessage: ctx.message,
      }),
      this.skillsService.getActiveSkillsPrompt(ctx.tenantId),
    ]);

    let systemPrompt = BASE_SYSTEM_PROMPT;
    if (skillsPrompt) {
      systemPrompt += `\n\n## Skills instalados\n\n${skillsPrompt}`;
    }
    if (memoryContext) {
      systemPrompt += `\n\n## Memoria cargada para esta conversación\n\n${memoryContext}`;
    }

    // Associate uploaded documents with this conversation and resolve for OpenAI
    let resolvedDocs: ResolvedDocument[] = [];
    if (ctx.documentIds?.length) {
      await this.filesService.attachToConversation(ctx.tenantId, ctx.documentIds, conversation.id);
      resolvedDocs = await this.resolveDocumentsForOpenAI(ctx.tenantId, ctx.documentIds, openai);
    }

    try {
      await this.runAgentLoop({ openai, model: fullConfig.model, conversation, ctx, resolvedDocs, subject, isNewConversation, systemPrompt });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error inesperado';
      subject.next({ type: 'error', message });
    } finally {
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
    ctx: ChatStreamContext;
    resolvedDocs: ResolvedDocument[];
    subject: Subject<ChatEvent>;
    isNewConversation: boolean;
    systemPrompt: string;
  }) {
    const { openai, model, conversation, ctx, resolvedDocs, subject, isNewConversation, systemPrompt } = params;

    // Build the initial input for this turn
    let input: OpenAI.Responses.ResponseInput;
    // The previous_response_id that will be sent to OpenAI
    let currentPrevResponseId = conversation.lastResponseId ?? undefined;

    if (ctx.questionToolCallId) {
      /**
       * User is answering a previous ask_user_question.
       *
       * We use `lastResponseId` as `previous_response_id` so OpenAI has the full
       * conversation context (including R1 that contained the function calls).
       * Then we submit function_call_output items for ALL function calls in R1:
       * - pendingToolOutputs: outputs for tools executed before the question
       * - questionAnswer: the user's answer to ask_user_question
       *
       * Note: the conversationId fix ensures we're always referencing the correct
       * conversation, so lastResponseId correctly points to R1.
       */
      const pendingOutputs = (conversation.pendingToolOutputs ?? []) as Array<{
        type: string;
        call_id: string;
        output: string;
      }>;

      input = [
        ...pendingOutputs.map(
          (o) =>
            ({
              type: 'function_call_output',
              call_id: o.call_id,
              output: o.output,
            }) as OpenAI.Responses.ResponseInputItem.FunctionCallOutput,
        ),
        {
          type: 'function_call_output',
          call_id: ctx.questionToolCallId,
          output: JSON.stringify({ answer: ctx.message }),
        } as OpenAI.Responses.ResponseInputItem.FunctionCallOutput,
      ];

      // currentPrevResponseId is already set to conversation.lastResponseId (= R1.id)
      console.log('[ChatService] Answering question:', {
        questionToolCallId: ctx.questionToolCallId,
        previousResponseId: currentPrevResponseId,
        pendingOutputCallIds: pendingOutputs.map((o) => o.call_id),
        totalInputItems: input.length,
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { pendingToolOutputs: [] },
      });
    } else {
      const userContent = this.buildUserContent(ctx.message, resolvedDocs);
      if (currentPrevResponseId) {
        // Continuing an existing conversation
        input = [{ role: 'user', content: userContent }];
      } else {
        // Fresh conversation — inject system prompt with memory context
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
      // The parentResponseId for the response we're about to create
      const parentResponseIdForThisCall = currentPrevResponseId;

      // Collects tool outputs to submit in next iteration
      const toolCallOutputs: Array<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> = [];

      console.log('[ChatService] Stream call:', {
        iteration,
        previousResponseId: currentPrevResponseId ?? null,
        inputItemTypes: Array.isArray(input) ? input.map((i: any) => i['type'] ?? i['role'] ?? 'unknown') : 'non-array',
      });

      const stream = openai.responses.stream({
        model,
        input,
        store: true,
        tools: ACCOUNTING_TOOLS as OpenAI.Responses.Tool[],
        tool_choice: 'auto',
        reasoning: { effort: 'medium', summary: 'auto' },
        ...(currentPrevResponseId ? { previous_response_id: currentPrevResponseId } : {}),
      } as Parameters<typeof openai.responses.stream>[0]);

      for await (const event of stream) {
        const ev = event as unknown as Record<string, unknown>;
        const evType = ev['type'] as string;

        // ── Thinking / Reasoning ─────────────────────────────
        if (evType === 'response.reasoning_summary_text.delta') {
          const delta = String(ev['delta'] ?? '');
          thinkingText += delta;
          subject.next({ type: 'thinking', delta });
          continue;
        }

        // ── Text output ──────────────────────────────────────
        if (evType === 'response.output_text.delta') {
          const delta = String(ev['delta'] ?? '');
          subject.next({ type: 'text_delta', delta });
          assistantText += delta;
          continue;
        }

        // ── Tool call started (partial info) ─────────────────
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
              label: TOOL_LABELS[toolName] ?? toolName,
            });
          }
          continue;
        }

        // ── Tool call completed (full args, execute now) ─────
        if (evType === 'response.output_item.done') {
          const item = ev['item'] as Record<string, unknown> | undefined;
          if (item?.['type'] !== 'function_call') continue;

          const itemId = String(item['id'] ?? '');
          // call_id is what OpenAI uses to match function_call_output
          const callId = String(item['call_id'] ?? itemId);
          const toolName = String(item['name'] ?? '');
          const argsStr = String(item['arguments'] ?? '{}');
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(argsStr); } catch { args = {}; }

          // Re-emit tool_start with full args
          subject.next({
            type: 'tool_start',
            toolCallId: itemId,
            name: toolName,
            args,
            label: TOOL_LABELS[toolName] ?? toolName,
          });

          if (toolName === 'ask_user_question') {
            // Pause loop — wait for user to answer
            hasQuestion = true;
            const payload = args as unknown as QuestionPayload;
            subject.next({ type: 'question', toolCallId: callId, payload, conversationId: conversation.id });
            // Persist callId so that when the user answers (e.g. after reload) we send the correct id to OpenAI
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
            // Update title in DB and broadcast to client — then continue the loop normally
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
            // Execute tool and collect output for next iteration
            const result = await this.toolExecutor.execute(toolName, args, ctx.tenantId, ctx.userId);
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

        // ── Response completed ───────────────────────────────
        if (evType === 'response.completed') {
          const response = ev['response'] as Record<string, unknown> | undefined;
          completedResponseId = String(response?.['id'] ?? '');
          const usageRaw = response?.['usage'] as Record<string, unknown> | undefined;
          completedUsage = {
            inputTokens: Number(usageRaw?.['input_tokens'] ?? 0),
            outputTokens: Number(usageRaw?.['output_tokens'] ?? 0),
          };
          // Capture the full output array for manual context reconstruction
          completedResponseOutput = (response?.['output'] as Array<Record<string, unknown>>) ?? [];
        }
      }

      // ── Post-stream: save thinking + text, decide what to do next ───
      if (thinkingText) {
        await this.saveMessage(conversation.id, 'assistant', {
          type: 'thinking',
          text: thinkingText,
        });
      }
      if (assistantText) {
        await this.saveMessage(conversation.id, 'assistant', {
          type: 'text',
          text: assistantText,
        });
      }

      currentPrevResponseId = completedResponseId;

      // Agent asked a question → stop loop, user will answer later.
      // Save lastResponseOutput + parentResponseId + any tool outputs that ran in the SAME response.
      if (hasQuestion) {
        console.log('[ChatService] Question detected, saving context:', {
          conversationId: conversation.id,
          lastResponseId: completedResponseId,
          parentResponseId: parentResponseIdForThisCall ?? null,
          outputItemCount: completedResponseOutput.length,
          outputItemTypes: completedResponseOutput.map((o) => o['type']),
          pendingToolOutputCount: toolCallOutputs.length,
          pendingToolCallIds: toolCallOutputs.map((o) => o.call_id),
        });

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

      // There are tool results → continue loop submitting them
      if (toolCallOutputs.length > 0) {
        input = toolCallOutputs;
        continue;
      }

      // No more tool calls → emit final done event
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

  /**
   * Loads documents from DB and resolves them for OpenAI:
   * - Images → presigned S3 URL (image_url, no data transfer)
   * - Excel files → converted to structured text locally, injected as text block
   * - Other files (PDF, etc.) → uploaded to OpenAI Files API, referenced by file_id
   */
  private async resolveDocumentsForOpenAI(
    tenantId: string,
    docIds: string[],
    openai: OpenAI,
  ): Promise<ResolvedDocument[]> {
    const docs = await this.filesService.findManyByIds(tenantId, docIds);
    const results: ResolvedDocument[] = [];

    for (const doc of docs) {
      if (doc.mimeType.startsWith('image/')) {
        // Presigned URL — OpenAI fetches the image directly from S3
        try {
          const { downloadUrl } = await this.filesService.findById(tenantId, doc.id);
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType, presignedUrl: downloadUrl });
        } catch {
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType });
        }
      } else if (EXCEL_MIME_TYPES.has(doc.mimeType)) {
        // Convert Excel to structured text — OpenAI Responses API doesn't parse xlsx natively
        try {
          const s3File = await this.filesService.findById(tenantId, doc.id);
          const response = await fetch(s3File.downloadUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const textContent = this.excelToText(buffer, doc.name);
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType, textContent });
        } catch {
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType });
        }
      } else {
        // Upload to OpenAI Files API so OpenAI can access the file by ID
        try {
          const s3File = await this.filesService.findById(tenantId, doc.id);
          const response = await fetch(s3File.downloadUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const oaiFile = await openai.files.create({
            file: new File([buffer], doc.name, { type: doc.mimeType }),
            purpose: 'assistants',
          });
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType, openaiFileId: oaiFile.id });
        } catch {
          results.push({ docId: doc.id, name: doc.name, mimeType: doc.mimeType });
        }
      }
    }

    return results;
  }

  /**
   * Converts an Excel workbook buffer to a readable plain-text representation.
   * Each sheet is rendered as a pipe-separated table for maximum LLM readability.
   */
  private excelToText(buffer: Buffer, filename: string): string {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const lines: string[] = [`[Archivo Excel: "${filename}"]`];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        lines.push(`\n--- Hoja: ${sheetName} ---`);
        lines.push(csv.trim());
      }
    }

    return lines.join('\n');
  }

  /**
   * Builds the user message content for OpenAI.
   * Uses presigned URLs (images) and file_ids (PDFs) — no base64.
   * Injects document IDs as text so the LLM can use tag_document / link_document_to_entry.
   */
  private buildUserContent(
    text: string,
    resolvedDocs: ResolvedDocument[],
  ): string | OpenAI.Responses.ResponseInputContent[] {
    if (!resolvedDocs.length) return text;

    const docRefs = resolvedDocs
      .filter((d) => d.docId)
      .map((d) => `[Documento adjunto: "${d.name}" (id: ${d.docId})]`)
      .join('\n');

    const fullText = docRefs ? `${docRefs}\n\n${text}` : text;

    // Inline Excel text content before the user message for readability
    const excelBlocks = resolvedDocs
      .filter((d) => d.textContent)
      .map((d) => d.textContent!)
      .join('\n\n');

    const combinedText = excelBlocks ? `${excelBlocks}\n\n${fullText}` : fullText;

    const parts: OpenAI.Responses.ResponseInputContent[] = [
      { type: 'input_text', text: combinedText } as OpenAI.Responses.ResponseInputText,
    ];

    for (const d of resolvedDocs) {
      if (d.mimeType.startsWith('image/') && d.presignedUrl) {
        parts.push({
          type: 'input_image',
          image_url: d.presignedUrl,
          detail: 'auto',
        } as OpenAI.Responses.ResponseInputImage);
      } else if (d.openaiFileId) {
        parts.push({
          type: 'input_file',
          file_id: d.openaiFileId,
        } as unknown as OpenAI.Responses.ResponseInputContent);
      }
      // Excel files are already embedded as text above; images/PDFs handled above
    }

    return parts;
  }

  private async ensureConversation(ctx: ChatStreamContext) {
    if (ctx.conversationId) {
      const existing = await this.prisma.conversation.findFirst({
        where: { id: ctx.conversationId, userId: ctx.userId, tenantId: ctx.tenantId },
        select: {
          id: true,
          lastResponseId: true,
          parentResponseId: true,
          lastResponseOutput: true,
          pendingToolOutputs: true,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.conversation.create({
      data: { userId: ctx.userId, tenantId: ctx.tenantId, title: 'Nueva conversación' },
      select: {
        id: true,
        lastResponseId: true,
        parentResponseId: true,
        lastResponseOutput: true,
        pendingToolOutputs: true,
      },
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

  async getConversation(conversationId: string, userId: string, tenantId: string) {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getConversations(userId: string, tenantId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId, tenantId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    if (conversations.length === 0) return [];

    const convIds = conversations.map((c) => c.id);
    const toolMessages = await this.prisma.message.findMany({
      where: { conversationId: { in: convIds }, role: 'tool' },
      select: { conversationId: true, toolName: true, toolArgs: true, toolResult: true },
    });

    const statsByConv = new Map<
      string,
      { postedEntries: number; memoryActions: number; pendingDrafts: number }
    >();

    for (const cid of convIds) {
      statsByConv.set(cid, { postedEntries: 0, memoryActions: 0, pendingDrafts: 0 });
    }

    const createdIdsByConv = new Map<string, Set<string>>();
    const postedIdsByConv = new Map<string, Set<string>>();

    for (const msg of toolMessages) {
      const cid = msg.conversationId;
      const name = msg.toolName ?? '';

      if (name === 'post_journal_entry') {
        const entryId = (msg.toolArgs as Record<string, unknown>)?.journalEntryId as string | undefined;
        if (entryId) {
          const set = postedIdsByConv.get(cid) ?? new Set();
          set.add(entryId);
          postedIdsByConv.set(cid, set);
        }
        const stats = statsByConv.get(cid)!;
        stats.postedEntries += 1;
      } else if (name === 'create_journal_entry') {
        const result = msg.toolResult as Record<string, unknown> | null;
        const entryId = result?.id as string | undefined;
        if (entryId) {
          const set = createdIdsByConv.get(cid) ?? new Set();
          set.add(entryId);
          createdIdsByConv.set(cid, set);
        }
      } else if (name === 'memory_store' || name === 'memory_search' || name === 'memory_delete') {
        const stats = statsByConv.get(cid)!;
        stats.memoryActions += 1;
      }
    }

    for (const cid of convIds) {
      const created = createdIdsByConv.get(cid) ?? new Set();
      const posted = postedIdsByConv.get(cid) ?? new Set();
      let pending = 0;
      for (const id of created) {
        if (!posted.has(id)) pending += 1;
      }
      const stats = statsByConv.get(cid)!;
      stats.pendingDrafts = pending;
    }

    return conversations.map((c) => ({
      ...c,
      stats: statsByConv.get(c.id)!,
    }));
  }

  async getMessages(conversationId: string, userId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId },
    });
    if (!conversation) return null;

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async deleteConversation(conversationId: string, userId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId },
    });
    if (!conversation) return null;

    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { deleted: true };
  }
}
