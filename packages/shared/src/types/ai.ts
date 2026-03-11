export type AiProvider = 'OPENAI';

export interface AiProviderConfig {
  id: string;
  provider: AiProvider;
  model: string;
  reasoningEffort: ReasoningEffort;
  isActive: boolean;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  /** API key is never returned to the client; only existence is indicated */
  hasApiKey?: boolean;
}

export interface UpsertAiConfigInput {
  provider: AiProvider;
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
}

// ─── Conversations & Messages ─────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'tool' | 'question';

export interface Conversation {
  id: string;
  title: string;
  lastResponseId: string | null;
  userId: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: MessageContent;
  toolName?: string | null;
  toolArgs?: Record<string, unknown> | null;
  toolResult?: unknown | null;
  conversationId: string;
  createdAt: Date;
}

export type MessageContent =
  | { type: 'text'; text: string }
  | { type: 'question'; payload: QuestionPayload };

// ─── Question Payloads ────────────────────────────────────

export interface QuestionOption {
  id: string;
  label: string;
}

export interface QuestionPayload {
  question: string;
  options: QuestionOption[];
  allowFreeText: boolean;
}

// ─── Chat SSE Events ──────────────────────────────────────

/** Fragmento de razonamiento interno del modelo */
export interface ThinkingEvent {
  type: 'thinking';
  delta: string;
}

/** Fragmento de texto de la respuesta final */
export interface TextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

/** El agente invocó una herramienta */
export interface ToolStartEvent {
  type: 'tool_start';
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  /** Label legible para mostrar en la UI */
  label: string;
}

/** Resultado de una herramienta ejecutada */
export interface ToolDoneEvent {
  type: 'tool_done';
  toolCallId: string;
  name: string;
  success: boolean;
  result: unknown;
  /** Resumen corto para mostrar en la UI (ej: "Asiento #42 creado") */
  summary: string;
}

/** Pregunta estructurada del agente para el usuario */
export interface QuestionEvent {
  type: 'question';
  toolCallId: string;
  payload: QuestionPayload;
  /** Conversation ID so the frontend can continue the turn when answering */
  conversationId: string;
}

/** Fin del stream */
export interface DoneEvent {
  type: 'done';
  responseId: string;
  conversationId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cachedTokens: number;
  };
}

/** Resumen acumulado de uso de tokens para la conversación */
export interface ConversationUsageSummary {
  conversationId: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCachedTokens: number;
  /** Breakdown by provider+model */
  byModel: Array<{
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  }>;
}

/** El agente actualizó el título de la conversación */
export interface TitleUpdateEvent {
  type: 'title_update';
  title: string;
}

/** Conversación creada/identificada — emitido justo después de ensureConversation */
export interface ConversationStartedEvent {
  type: 'conversation_started';
  conversationId: string;
}

/** Error durante el stream */
export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type ChatEvent =
  | ConversationStartedEvent
  | ThinkingEvent
  | TextDeltaEvent
  | ToolStartEvent
  | ToolDoneEvent
  | QuestionEvent
  | TitleUpdateEvent
  | DoneEvent
  | ErrorEvent;

// ─── Documents ───────────────────────────────────────────

export type DocumentCategory =
  | 'FACTURA'
  | 'BOLETA'
  | 'NOTA_CREDITO'
  | 'NOTA_DEBITO'
  | 'CONTRATO'
  | 'ESTATUTOS'
  | 'DECLARACION'
  | 'COMPROBANTE'
  | 'REMUNERACION'
  | 'OTRO';

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  FACTURA: 'Factura',
  BOLETA: 'Boleta',
  NOTA_CREDITO: 'Nota de Crédito',
  NOTA_DEBITO: 'Nota de Débito',
  CONTRATO: 'Contrato',
  ESTATUTOS: 'Estatutos',
  DECLARACION: 'Declaración',
  COMPROBANTE: 'Comprobante',
  REMUNERACION: 'Remuneración',
  OTRO: 'Otro',
};

export interface DocumentRecord {
  id: string;
  name: string;
  s3Key: string;
  mimeType: string;
  sizeBytes: number;
  category: DocumentCategory;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  uploadedById: string;
  uploadedBy?: { id: string; firstName: string; lastName: string };
  conversationId?: string | null;
  conversation?: { id: string; title: string } | null;
  journalEntries?: Array<{
    journalEntry: { id: string; number: number; description: string; status: string };
  }>;
  downloadUrl?: string;
}

// ─── Pending upload (frontend only — before upload completes) ─────────────────

export interface PendingAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  /** Preview URL (object URL) */
  previewUrl?: string;
  /** Upload state */
  status: 'uploading' | 'done' | 'error';
  /** Set after successful upload */
  documentId?: string;
  errorMessage?: string;
}

// ─── Chat Request ─────────────────────────────────────────

export interface ChatRequest {
  message: string;
  conversationId?: string;
  /** Usada cuando el mensaje es la respuesta a una QuestionEvent */
  questionToolCallId?: string;
  /** IDs of documents already uploaded via POST /files/upload */
  documentIds?: string[];
}

// ─── Reasoning Effort ─────────────────────────────────────

export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export const REASONING_EFFORT_OPTIONS: Array<{ id: ReasoningEffort; label: string; description: string }> = [
  { id: 'none', label: 'Ninguno', description: 'Sin razonamiento interno — respuestas más rápidas y económicas' },
  { id: 'low', label: 'Bajo', description: 'Razonamiento mínimo — buen balance velocidad/calidad' },
  { id: 'medium', label: 'Medio', description: 'Razonamiento moderado — recomendado para uso general' },
  { id: 'high', label: 'Alto', description: 'Razonamiento profundo — mejor calidad en tareas complejas' },
];

// ─── Available Models ─────────────────────────────────────

export interface AiModelDef {
  id: string;
  label: string;
  description: string;
  contextWindow: string;
  defaultReasoningEffort: ReasoningEffort;
  supportedReasoningEfforts: ReasoningEffort[];
}

export const AI_MODELS: Record<AiProvider, AiModelDef[]> = {
  OPENAI: [
    {
      id: 'gpt-5.4',
      label: 'GPT-5.4',
      description: 'Modelo más reciente de OpenAI — 1M de contexto, computer-use nativo',
      contextWindow: '1.05M tokens',
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: ['none', 'low', 'medium', 'high'],
    },
    {
      id: 'gpt-5.4-pro',
      label: 'GPT-5.4 Pro',
      description: 'Máximo rendimiento para tareas complejas y profesionales',
      contextWindow: '1.05M tokens',
      defaultReasoningEffort: 'high',
      supportedReasoningEfforts: ['medium', 'high'],
    },
    {
      id: 'gpt-5.2-2025-12-11',
      label: 'GPT-5.2 (Legacy)',
      description: 'Modelo anterior — disponible hasta junio 2026',
      contextWindow: '200K tokens',
      defaultReasoningEffort: 'medium',
      supportedReasoningEfforts: ['low', 'medium', 'high'],
    },
  ],
};
