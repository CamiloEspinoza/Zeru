import { z } from 'zod';

export const upsertAiConfigSchema = z.object({
  provider: z.enum(['OPENAI']),
  apiKey: z.string().min(1, 'API key requerida'),
  model: z.string().min(1, 'Modelo requerido'),
  reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional(),
});

export const validateKeySchema = z.object({
  provider: z.enum(['OPENAI']).default('OPENAI'),
  apiKey: z.string().min(1, 'API key requerida'),
});

export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Mensaje requerido'),
  conversationId: z.string().uuid().optional(),
  questionToolCallId: z.string().optional(),
  /** IDs of documents already uploaded via POST /files/upload */
  documentIds: z.array(z.string().uuid()).optional(),
  /** Uploaded images metadata (for social media post creation) */
  uploadedImages: z
    .array(z.object({ s3Key: z.string(), imageUrl: z.string() }))
    .optional(),
});

export const installSkillSchema = z.object({
  repoUrl: z.string().min(1, 'La URL o comando de instalación es requerido'),
});

export const toggleSkillSchema = z.object({
  isActive: z.boolean(),
});

export type InstallSkillDto = z.infer<typeof installSkillSchema>;
export type ToggleSkillDto = z.infer<typeof toggleSkillSchema>;

export const updateMemorySchema = z.object({
  content: z.string().min(1).optional(),
  category: z.enum(['PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT']).optional(),
  importance: z.number().int().min(1).max(10).optional(),
});

export const upsertGeminiConfigSchema = z.object({
  apiKey: z.string().min(1, 'API key requerida'),
});

export type UpsertAiConfigDto = z.infer<typeof upsertAiConfigSchema>;
export type ValidateKeyDto = z.infer<typeof validateKeySchema>;
export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type UpdateMemoryDto = z.infer<typeof updateMemorySchema>;
export type UpsertGeminiConfigDto = z.infer<typeof upsertGeminiConfigSchema>;

// ── AI Pricing DTOs ──────────────────────────────────────────

export const createPricingSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  contextTier: z.string().default('DEFAULT'),
  pricingUnit: z.enum(['PER_1M_TOKENS', 'PER_1K_CHARS', 'PER_HOUR', 'PER_MINUTE', 'PER_IMAGE', 'PER_GENERATION']),
  inputPrice: z.number().min(0),
  outputPrice: z.number().min(0),
  cachedPrice: z.number().min(0).default(0),
  longContextThreshold: z.number().int().positive().optional(),
  description: z.string().optional(),
  validFrom: z.string().datetime().optional(),
});

export type CreatePricingDto = z.infer<typeof createPricingSchema>;

export const updatePricingSchema = z.object({
  inputPrice: z.number().min(0).optional(),
  outputPrice: z.number().min(0).optional(),
  cachedPrice: z.number().min(0).optional(),
  description: z.string().optional(),
});

export type UpdatePricingDto = z.infer<typeof updatePricingSchema>;

export const recalculateCostsSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  provider: z.string().optional(),
  model: z.string().optional(),
});

export type RecalculateCostsDto = z.infer<typeof recalculateCostsSchema>;

export const costQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CostQueryDto = z.infer<typeof costQuerySchema>;
