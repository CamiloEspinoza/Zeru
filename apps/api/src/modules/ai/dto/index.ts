import { z } from 'zod';

export const upsertAiConfigSchema = z.object({
  provider: z.enum(['OPENAI']),
  apiKey: z.string().min(1, 'API key requerida'),
  model: z.string().min(1, 'Modelo requerido'),
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
});

export const updateMemorySchema = z.object({
  content: z.string().min(1).optional(),
  category: z.enum(['PREFERENCE', 'FACT', 'PROCEDURE', 'DECISION', 'CONTEXT']).optional(),
  importance: z.number().int().min(1).max(10).optional(),
});

export type UpsertAiConfigDto = z.infer<typeof upsertAiConfigSchema>;
export type ValidateKeyDto = z.infer<typeof validateKeySchema>;
export type ChatRequestDto = z.infer<typeof chatRequestSchema>;
export type UpdateMemoryDto = z.infer<typeof updateMemorySchema>;
