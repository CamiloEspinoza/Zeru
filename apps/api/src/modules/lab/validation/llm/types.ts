import { z } from 'zod';

/** Output of a structured LLM call. Always includes the parsed + typed data,
 *  plus metadata the caller needs to log usage and reason about latency. */
export interface StructuredLlmResult<T> {
  data: T;
  provider: 'OPENAI' | 'ANTHROPIC';
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  completedAt: Date;
}

/** Input for ValidationLlmService.callStructured(). */
export interface StructuredLlmCall<T extends z.ZodTypeAny> {
  /** Stable feature tag persisted in AiUsageLog (e.g. 'validation.sample'). */
  feature: string;
  /** Tenant scope for usage logging. */
  tenantId: string;
  /** Markdown prompt body. Variables must be pre-rendered before this call. */
  prompt: string;
  /** Zod schema the model output MUST conform to. */
  schema: T;
  /** Logical name used in zodTextFormat(schema, schemaName). Keep stable per agent. */
  schemaName: string;
  /** Provider preference. Defaults to 'OPENAI'. */
  provider?: 'OPENAI' | 'ANTHROPIC';
  /** Override model. If omitted, provider's default small model is used. */
  model?: string;
  /** Temperature. Defaults to 0 for deterministic-ish outputs. */
  temperature?: number;
  /** Optional user message, if the caller wants to separate system vs user. */
  userMessage?: string;
}

/** A prompt loaded from a .md file. */
export interface PromptTemplate {
  /** Stable id, same as the file name without extension. */
  key: string;
  /** Raw markdown body, with {{variable}} placeholders not yet rendered. */
  body: string;
}
