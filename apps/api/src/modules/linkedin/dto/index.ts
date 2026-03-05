import { z } from 'zod';

export const linkedInCallbackSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  state: z.string().min(1, 'Estado requerido'),
});

export const linkedInChatSchema = z.object({
  message: z.string().min(1, 'Mensaje requerido'),
  conversationId: z.string().uuid().optional(),
  questionToolCallId: z.string().optional(),
});

export const linkedInUpdateConfigSchema = z.object({
  autoPublish: z.boolean().optional(),
  defaultVisibility: z.enum(['PUBLIC', 'CONNECTIONS']).optional(),
  contentPillars: z.array(z.string()).optional(),
});

export const linkedInListPostsSchema = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  contentPillar: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
});

export type LinkedInCallbackDto = z.infer<typeof linkedInCallbackSchema>;
export type LinkedInChatDto = z.infer<typeof linkedInChatSchema>;
export type LinkedInUpdateConfigDto = z.infer<typeof linkedInUpdateConfigSchema>;
export type LinkedInListPostsDto = z.infer<typeof linkedInListPostsSchema>;
