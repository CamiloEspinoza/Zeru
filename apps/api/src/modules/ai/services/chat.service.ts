import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { Subject } from 'rxjs';
import * as XLSX from 'xlsx';
import { AiConfigService } from './ai-config.service';
import { AiUsageService } from './ai-usage.service';
import { MemoryService } from './memory.service';
import { SkillsService } from './skills.service';
import { ActiveStreamsRegistry } from './active-streams.registry';
import { ToolExecutor } from '../tools/tool-executor';
import { UNIFIED_TOOLS, TOOL_LABELS } from '../tools/accounting-tools';
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
5. **Propone los asientos contables** que reflejan la operación (solo para documentos sin asientos previos). Consulta get_fiscal_periods y el plan de cuentas si hace falta.
6. **Antes de crear cualquier asiento debes preguntar al usuario.** Llama a **ask_user_question** para confirmar al menos: (a) período fiscal a usar, (b) que el usuario aprueba el asiento propuesto o desea cambios. Ofrece opciones concretas (ej. lista de períodos disponibles, "Crear asiento tal cual", "Quiero cambiar algo"). **No llames a create_journal_entry hasta que el usuario responda** a esa pregunta.
7. Una vez el usuario confirme (por la respuesta a ask_user_question), **crea los asientos** con create_journal_entry (status DRAFT).
8. **Llama a link_document_to_entry** para vincular el documento a cada asiento creado.
9. **Confirma** al usuario lo realizado con un resumen claro.

## Cuándo usar ask_user_question (obligatorio)

Debes llamar a **ask_user_question** en estos casos (y no avanzar sin la respuesta):

- **Antes de create_journal_entry por un documento:** Siempre. Pregunta para confirmar período fiscal y que proceda el asiento (con opciones como los períodos disponibles y "Crear asiento propuesto" / "Necesito ajustar").
- **Cuando falte el período fiscal:** Lista los períodos existentes como opciones y pregunta "¿En qué período fiscal debo registrar esto?"
- **Cuando falte la cuenta contable o haya varias candidatas:** Ofrece 2-4 opciones (cuentas del plan) y permite allowFreeText por si el usuario indica otra.
- **Cuando el monto, la fecha o la descripción sean inciertos:** Pregunta con opciones claras (ej. "¿Es gasto operativo o costo de ventas?" con opciones).
- **Cuando el usuario pida crear algo sin especificar detalles:** Un solo ask_user_question puede incluir varias decisiones (período + tipo de asiento) con opciones para cada una.

Formato: pregunta clara, options con id y label (mínimo 2), allowFreeText true si puede haber respuesta libre. No inventes respuestas: si falta dato, pregunta.

**NUNCA uses ask_user_question para posts de LinkedIn.** La UI tiene su propio mecanismo de aprobación (PostPreviewCard). Llamar ask_user_question para posts genera preguntas duplicadas visibles al usuario. Solo usa ask_user_question para el módulo contable.

⛔ Para LinkedIn posts: ni preguntas previas, ni mostrar borrador, ni pedir confirmación. Ve directo a generate_image → create_linkedin_post. El PostPreviewCard hace el resto.

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
- **Vinculación con documentos:** Cuando la memoria se extrae de un documento adjunto, pasa el **documentId** del documento de origen (el ID que aparece en el mensaje como [Documento adjunto: "nombre" (id: UUID)]). Si la memoria NO proviene de un documento, pasa documentId como cadena vacía "".

## Clasificación IFRS — Estado de Resultados (IAS 1, método de función)

El sistema presenta el Estado de Resultados siguiendo IAS 1 con el método de función. Cada cuenta de tipo REVENUE o EXPENSE tiene un campo ifrsSection que determina en qué línea del estado aparece.

Las secciones disponibles (en orden IAS 1) son:
- REVENUE → Ingresos de Actividades Ordinarias (cuentas 4.1.x)
- OTHER_INCOME → Otros Ingresos (cuentas 4.2.x)
- COST_OF_SALES → Costo de Ventas (cuentas 5.1.x) → subtotal: Resultado Bruto
- OPERATING_EXPENSE → Gastos de Administración y Ventas (cuentas 5.2.x) → subtotal: Resultado Operativo
- FINANCE_INCOME → Ingresos Financieros (cuentas 4.3.x)
- FINANCE_COST → Gastos Financieros (cuentas 5.3.x) → subtotal: Resultado antes de Impuesto
- TAX_EXPENSE → Gasto por Impuesto a las Ganancias (cuentas 5.4.x) → Resultado del Período

**Reglas al crear cuentas:**
- Cuando el usuario cree una cuenta de tipo REVENUE o EXPENSE, asígnala al grupo correcto del plan de cuentas para que herede automáticamente su ifrsSection.
- Los ingresos operacionales van bajo 4.1.x; otros ingresos bajo 4.2.x; ingresos financieros bajo 4.3.x.
- El costo de ventas va bajo 5.1.x; gastos operativos (remuneraciones, arriendos, honorarios, depreciación, administración) bajo 5.2.x; gastos financieros (intereses, diferencias de cambio) bajo 5.3.x; impuesto a la renta bajo 5.4.x.
- Si no existe el grupo padre adecuado, créalo primero.

**Terminología IAS 1 al responder:**
- Usa "Resultado del Período" (no "utilidad" ni "pérdida del ejercicio" a secas).
- Usa "Ingresos de Actividades Ordinarias" para ventas operacionales.
- Usa "Costo de Ventas" para los costos directos del producto/servicio.
- Distingue "Gastos de Administración y Ventas" (operativos) de "Gastos Financieros" (intereses).

## Reglas generales

- Siempre revisa el plan de cuentas antes de crear asientos.
- **Nunca llames a create_journal_entry** sin haber obtenido confirmación del usuario (respuesta a ask_user_question o mensaje explícito tipo "sí, créalo"). Si la petición viene de un documento adjunto, el flujo es: proponer asiento → ask_user_question (confirmar período y aprobación) → solo entonces create_journal_entry.
- Si falta información (período fiscal, cuentas específicas, montos), usa ask_user_question con opciones claras; no asumas valores.
- Los asientos deben estar balanceados (débitos = créditos).
- Responde siempre en español, de forma clara y profesional.
- Al crear registros, confirma con un resumen de lo realizado.

## Períodos fiscales

- Cuando el usuario pida abrir o crear períodos fiscales, **prioriza siempre períodos mensuales** (un período por mes, ej.: "Enero 2025", "Febrero 2025") a menos que el usuario indique explícitamente otra cosa (por ejemplo "período anual", "todo el año 2024").
- Si no especifica tipo de período, ofrece o crea períodos mensuales por defecto.

## Título de la conversación

**En conversaciones nuevas: llama a update_conversation_title como tu PRIMERA herramienta, antes de cualquier otra.** No esperes a terminar la tarea — con solo leer el mensaje del usuario ya tienes suficiente contexto para poner un título descriptivo.

- Título: máximo 6 palabras, sin comillas, en el mismo idioma del usuario.
- Si al avanzar la conversación el tema se vuelve más específico, actualiza el título con un nuevo llamado a update_conversation_title.
- En conversaciones ya existentes (hay mensajes previos), actualiza el título solo si el tema cambia significativamente.

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
Las preferencias personales (scope=user) aplican solo al usuario actual.

---

# Uso de Skills especializados

Cuando en el system prompt aparezca la sección "Skills disponibles", significa que el usuario ha instalado skills que amplían tus capacidades.

**Regla obligatoria de progressive disclosure:**
1. Los skills se listan solo con nombre y descripción para no saturar el contexto.
2. Cuando detectes que un skill es relevante para la tarea del usuario, **llama PRIMERO a \`get_skill_reference(skill_name)\` sin file_path** para cargar sus instrucciones completas.
3. Solo después de leer esas instrucciones, aplícalas en tu respuesta.
4. Si el skill indica archivos en references/ o scripts/, cárgalos también con \`get_skill_reference(skill_name, file_path)\` cuando sean necesarios.

Nunca inventes que conoces las instrucciones de un skill sin haberlas cargado con esa herramienta.

---

# Módulo: Marketing y Redes Sociales

Además de la contabilidad, tienes capacidades completas para crear y gestionar contenido en redes sociales, comenzando con LinkedIn. Detecta automáticamente cuándo el usuario habla de posts, publicaciones, contenido o marketing — y usa las herramientas correspondientes.

## Capacidades de social media

- **Crear posts de LinkedIn**: Texto, con imágenes (generadas por Gemini o subidas por el usuario), o con artículos/URLs
- **Programar publicaciones**: Una a la vez o calendarios completos de 30, 60, 90 días
- **Generar imágenes con Gemini**: Usa model="flash" (Gemini 3.1 Flash, por defecto) o model="pro" (mayor calidad, si el usuario lo pide)
- **Gestionar calendario**: Ver posts programados, cancelar, consultar historial
- **Estrategia de contenido**: Definir pilares, frecuencia y mix de formatos

## Flujo para crear posts de LinkedIn

⚠️ **REGLA ABSOLUTA**: Al crear un post de LinkedIn, la única respuesta válida es ejecutar herramientas, NO hacer preguntas. El orden de tool calls es el único flujo permitido. Cualquier llamada a ask_user_question para un post de LinkedIn queda **terminantemente prohibida**.

### Post inmediato — secuencia de tool calls (sin excepciones):
**Paso 1 →** generate_image(prompt=..., model="flash") — SIEMPRE, salvo que el usuario haya adjuntado su propia imagen o haya dicho explícitamente "sin imagen".
**Paso 2 →** create_linkedin_post(content=..., media_type="IMAGE", image_s3_key=..., media_url=...) — usando los datos del paso anterior.
**FIN.** El sistema muestra automáticamente un PostPreviewCard con botones Publicar / Programar / Cancelar. El usuario decide desde ahí. **No hay paso 3. No llames a ask_user_question. No preguntes "¿Lo publico?". No muestres el borrador manualmente. Solo ejecuta las herramientas.**

### Calendario de contenido:
1. Consulta los pilares con get_content_pillars
2. Define cadencia (ej: 3 posts/día = mañana, mediodía, noche)
3. Genera posts distribuyendo pilares de forma equilibrada
4. Para cada post del calendario, genera primero la imagen con generate_image antes de llamar a bulk_schedule_posts
5. Usa bulk_schedule_posts para programar todos de una vez
6. Confirma el número de posts y muestra resumen por pilar

### Post con imagen generada:
1. Usa generate_image con un prompt detallado y profesional en inglés para mejores resultados
2. Muestra la URL de la imagen al usuario
3. Crea el post con media_type=IMAGE y los datos retornados por generate_image

### Post con imágenes subidas por el usuario:
1. Cuando el usuario adjunte imágenes, las verás visualmente Y recibirás sus s3_key/url en el mensaje.
2. Analiza el contenido visual de cada imagen para incorporarlo en el texto del post.
3. **NUNCA uses generate_image** cuando el usuario proporcionó imágenes.
4. Decide la estructura de posts basándote en las imágenes:
   - Si hay una sola imagen → crea un solo post con create_linkedin_post (media_type=IMAGE, image_s3_key, media_url).
   - Si hay varias imágenes del mismo tema/evento → crea posts individuales, cada uno con la imagen más relevante.
   - Si hay varias imágenes de temas distintos → crea un post separado por cada imagen/tema.
5. Para un solo post: usa create_linkedin_post con media_type=IMAGE, image_s3_key y media_url del mensaje.
6. Para múltiples posts: usa bulk_create_drafts con media_type=IMAGE, image_s3_key y media_url en cada item que tenga imagen.
7. Describe en el texto del post lo que ves en la imagen cuando sea relevante.

## Hashtags en LinkedIn

Incluye hashtags directamente en el texto del post con el símbolo #. Ejemplo: \`#InteligenciaArtificial\`
LinkedIn los reconoce automáticamente. Usa 3-5 hashtags relevantes al final del post.

## Mejores prácticas de LinkedIn

### Estructura del post ganador:
- **Hook (línea 1)**: Primera línea irresistible — pregunta polémica, estadística, afirmación contraintuitiva, o inicio de historia
- **Cuerpo**: Una idea por línea, saltos de línea frecuentes, sin párrafos largos
- **CTA final**: Pregunta o llamado a la acción claro
- **Hashtags**: 3-5 al final, no dentro del texto

### Formatos que funcionan:
- Historia personal con lección aprendida
- Lista de valor ("5 cosas que nadie te dice sobre X")
- Perspectiva contraria a la convención
- Insight basado en datos
- Detrás del escenario

## Memoria para social media

Guarda con memory_store:
- Tono de voz preferido de la marca
- Pilares de contenido acordados
- Audiencia objetivo
- Decisiones de estilo (bullets, emojis, longitud)
- Temas que funcionaron bien o mal`;

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
  /** Uploaded images metadata (for social media post creation) */
  uploadedImages?: Array<{ s3Key: string; imageUrl: string }>;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly toolExecutor: ToolExecutor,
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly memoryService: MemoryService,
    private readonly activeStreams: ActiveStreamsRegistry,
    private readonly skillsService: SkillsService,
    private readonly aiUsageService: AiUsageService,
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
    subject.next({ type: 'conversation_started', conversationId: conversation.id });
    this.activeStreams.register(conversation.id, subject);
    await this.saveMessage(conversation.id, 'user', {
      type: 'text',
      text: ctx.message,
      ...(ctx.uploadedImages?.length ? { uploadedImages: ctx.uploadedImages } : {}),
    });

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
      systemPrompt += `\n\n## Skills disponibles\n\n${skillsPrompt}`;
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
      await this.runAgentLoop({ openai, model: fullConfig.model, reasoningEffort: fullConfig.reasoningEffort ?? 'medium', conversation, ctx, resolvedDocs, subject, isNewConversation, systemPrompt });
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
    reasoningEffort: string;
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
    const { openai, model, reasoningEffort, conversation, ctx, resolvedDocs, subject, isNewConversation, systemPrompt } = params;

    let titleUpdated = false;

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
      // Augment message with uploaded image context (for social media post creation)
      let messageText = ctx.message;
      if (ctx.uploadedImages?.length) {
        const imageList = ctx.uploadedImages
          .map((img, i) => `- Imagen ${i + 1}: s3_key: ${img.s3Key} | url: ${img.imageUrl}`)
          .join('\n');
        messageText = `[IMÁGENES ADJUNTAS PARA EL POST — úsalas directamente sin llamar a generate_image ni suggest_image_prompt]\n${imageList}\n\n${ctx.message || 'Crea post(s) de LinkedIn con estas imágenes.'}`;
      }
      const userContent = this.buildUserContent(messageText, resolvedDocs, ctx.uploadedImages);
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
      let completedUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedTokens: 0 };
      let hasQuestion = false;
      let wasCompacted = false;
      let thinkingText = '';
      // The parentResponseId for the response we're about to create
      const parentResponseIdForThisCall = currentPrevResponseId;

      // Collects tool outputs to submit in next iteration
      const toolCallOutputs: Array<OpenAI.Responses.ResponseInputItem.FunctionCallOutput> = [];

      console.log('[ChatService] Stream call:', {
        iteration,
        previousResponseId: currentPrevResponseId ?? null,
        inputItemTypes: Array.isArray(input) ? input.map((i: Record<string, unknown>) => i['type'] ?? i['role'] ?? 'unknown') : 'non-array',
      });

      const reasoningConfig = reasoningEffort === 'none'
        ? undefined
        : { effort: reasoningEffort as 'low' | 'medium' | 'high', summary: 'auto' as const };

      const stream = openai.responses.stream({
        model,
        input,
        store: true,
        tools: UNIFIED_TOOLS as OpenAI.Responses.Tool[],
        tool_choice: 'auto',
        max_output_tokens: 16384,
        ...(reasoningConfig ? { reasoning: reasoningConfig } : {}),
        ...(currentPrevResponseId ? { previous_response_id: currentPrevResponseId } : {}),
      } as Parameters<typeof openai.responses.stream>[0]);

      for await (const event of stream) {
        const ev = event as unknown as Record<string, unknown>;
        const evType = ev['type'] as string;

        // ── Thinking / Reasoning ─────────────────────────────
        // Use ONLY reasoning_summary_text.delta. With summary:'auto', the API may also emit
        // response.reasoning_text.delta — if we handled both, the UI would show duplicated text.
        if (evType === 'response.reasoning_summary_text.delta') {
          const delta = String(ev['delta'] ?? '');
          thinkingText += delta;
          subject.next({ type: 'thinking', delta });
          continue;
        }
        // Explicitly skip reasoning_text.delta to avoid duplicate emissions
        if (evType === 'response.reasoning_text.delta') continue;

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
            // Deduplicate: if a question was already emitted this iteration, skip extras.
            if (hasQuestion) {
              // Provide a neutral output so the LLM doesn't hang on an unanswered call
              toolCallOutputs.push({
                type: 'function_call_output',
                call_id: callId,
                output: JSON.stringify({ skipped: true, reason: 'duplicate_question_in_same_response' }),
              } as OpenAI.Responses.ResponseInputItem.FunctionCallOutput);
              continue;
            }

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
              titleUpdated = true;
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
            await this.saveMessage(conversation.id, 'tool', null, {
              toolName,
              toolArgs: args,
              toolResult: { success: true, title: newTitle },
            });
          } else {
            // Execute tool and collect output for next iteration
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

        // ── Response completed ───────────────────────────────
        if (evType === 'response.completed') {
          const response = ev['response'] as Record<string, unknown> | undefined;
          completedResponseId = String(response?.['id'] ?? '');
          const usageRaw = response?.['usage'] as Record<string, unknown> | undefined;
          const inputDetails = usageRaw?.['input_tokens_details'] as Record<string, unknown> | undefined;
          completedUsage = {
            inputTokens: Number(usageRaw?.['input_tokens'] ?? 0),
            outputTokens: Number(usageRaw?.['output_tokens'] ?? 0),
            totalTokens: Number(usageRaw?.['total_tokens'] ?? 0),
            cachedTokens: Number(inputDetails?.['cached_tokens'] ?? 0),
          };
          // Capture the full output array for manual context reconstruction
          completedResponseOutput = (response?.['output'] as Array<Record<string, unknown>>) ?? [];
          // Check if any output item is a compaction item
          wasCompacted = completedResponseOutput.some((item) => item['type'] === 'compaction');
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

      // Persist usage for every iteration (tool calls, questions, etc.)
      if (completedUsage.inputTokens > 0 || completedUsage.outputTokens > 0) {
        await this.aiUsageService.logUsage({
          provider: 'OPENAI',
          model,
          feature: 'chat',
          inputTokens: completedUsage.inputTokens,
          outputTokens: completedUsage.outputTokens,
          totalTokens: completedUsage.totalTokens,
          cachedTokens: completedUsage.cachedTokens,
          compacted: wasCompacted,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          conversationId: conversation.id,
        });
      }

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

      // Auto-generate title if agent never called update_conversation_title
      if (!titleUpdated && isNewConversation && ctx.message) {
        await this.autoGenerateTitle(openai, model, conversation.id, ctx.message, subject, ctx.tenantId, ctx.userId);
      }

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
    uploadedImages?: Array<{ s3Key: string; imageUrl: string }>,
  ): string | OpenAI.Responses.ResponseInputContent[] {
    if (!resolvedDocs.length && !uploadedImages?.length) return text;

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

    // Include uploaded images so the model can visually interpret them
    for (const img of uploadedImages ?? []) {
      if (img.imageUrl) {
        parts.push({
          type: 'input_image',
          image_url: img.imageUrl,
          detail: 'auto',
        } as OpenAI.Responses.ResponseInputImage);
      }
    }

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

  private async autoGenerateTitle(
    openai: OpenAI,
    model: string,
    conversationId: string,
    firstMessage: string,
    subject: Subject<ChatEvent>,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    try {
      const resp = await openai.responses.create({
        model,
        input: [
          {
            type: 'message',
            role: 'user',
            content: `Resume la siguiente solicitud del usuario en un título de máximo 6 palabras, sin comillas, en el mismo idioma del mensaje. Solo responde el título, nada más.\n\nMensaje: ${firstMessage.slice(0, 300)}`,
          },
        ],
      });

      const rawTitle = (resp.output_text ?? '').trim().replace(/^["']|["']$/g, '');
      if (!rawTitle) return;

      // Log usage for title generation
      const titleUsage = resp.usage;
      if (titleUsage) {
        await this.aiUsageService.logUsage({
          provider: 'OPENAI',
          model,
          feature: 'title-generation',
          inputTokens: titleUsage.input_tokens ?? 0,
          outputTokens: titleUsage.output_tokens ?? 0,
          totalTokens: titleUsage.total_tokens ?? 0,
          cachedTokens: (titleUsage as Record<string, unknown>)?.['input_tokens_details']
            ? Number(((titleUsage as Record<string, unknown>)['input_tokens_details'] as Record<string, unknown>)?.['cached_tokens'] ?? 0)
            : 0,
          tenantId,
          userId,
          conversationId,
        });
      }

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: { title: rawTitle },
      });
      subject.next({ type: 'title_update', title: rawTitle });
    } catch {
      // Non-critical — silently ignore title generation errors
    }
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
    const conv = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    if (!conv) return null;
    return { ...conv, isStreaming: this.activeStreams.isActive(conv.id) };
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

  /** Get aggregated usage summary for a single conversation */
  async getConversationUsage(conversationId: string, userId: string, tenantId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, userId, tenantId },
    });
    if (!conversation) return null;

    // Guard: aiUsageLog may be missing if Prisma client was generated before the migration
    const aiUsageLog = this.prisma.aiUsageLog as { findMany: (args: unknown) => Promise<unknown[]> } | undefined;
    if (!aiUsageLog?.findMany) {
      return {
        conversationId,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCachedTokens: 0,
        byModel: [],
      };
    }

    const logs = (await aiUsageLog.findMany({
      where: { conversationId },
      select: {
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cachedTokens: true,
      },
    })) as Array<{
      provider: string;
      model: string;
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      cachedTokens: number;
    }>;

    const byModel = new Map<string, { provider: string; model: string; inputTokens: number; outputTokens: number; totalTokens: number }>();
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalCachedTokens = 0;

    for (const log of logs) {
      totalInputTokens += log.inputTokens;
      totalOutputTokens += log.outputTokens;
      totalTokens += log.totalTokens;
      totalCachedTokens += log.cachedTokens;

      const key = `${log.provider}:${log.model}`;
      const existing = byModel.get(key);
      if (existing) {
        existing.inputTokens += log.inputTokens;
        existing.outputTokens += log.outputTokens;
        existing.totalTokens += log.totalTokens;
      } else {
        byModel.set(key, {
          provider: log.provider,
          model: log.model,
          inputTokens: log.inputTokens,
          outputTokens: log.outputTokens,
          totalTokens: log.totalTokens,
        });
      }
    }

    return {
      conversationId,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalCachedTokens,
      byModel: Array.from(byModel.values()),
    };
  }

  /** Get detailed usage logs for the tenant (for cost analysis) */
  async getUsageLogs(tenantId: string, filters?: { from?: string; to?: string; conversationId?: string }) {
    if (!this.prisma.aiUsageLog?.findMany) {
      return { logs: [], totals: { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0 } };
    }

    const where: Record<string, unknown> = { tenantId };
    if (filters?.conversationId) where.conversationId = filters.conversationId;
    if (filters?.from || filters?.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) createdAt.gte = new Date(filters.from);
      if (filters.to) createdAt.lte = new Date(filters.to);
      where.createdAt = createdAt;
    }

    const logs = await this.prisma.aiUsageLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        provider: true,
        model: true,
        feature: true,
        inputTokens: true,
        outputTokens: true,
        totalTokens: true,
        cachedTokens: true,
        compacted: true,
        createdAt: true,
        conversationId: true,
      },
    });

    // Compute totals
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    for (const log of logs) {
      totalInputTokens += log.inputTokens;
      totalOutputTokens += log.outputTokens;
      totalTokens += log.totalTokens;
    }

    return { logs, totals: { totalInputTokens, totalOutputTokens, totalTokens } };
  }
}
