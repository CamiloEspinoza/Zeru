import { z } from 'zod';

export const fmDatabaseParamSchema = z.object({
  database: z.string().min(1),
});

export const fmLayoutParamSchema = z.object({
  database: z.string().min(1),
  layout: z.string().min(1),
});

export const fmSearchSchema = z.object({
  query: z.array(z.record(z.string())).min(1),
  offset: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(200).optional(),
  sort: z
    .array(z.object({ fieldName: z.string(), sortOrder: z.enum(['ascend', 'descend']) }))
    .optional(),
});

export type FmDatabaseParam = z.infer<typeof fmDatabaseParamSchema>;
export type FmLayoutParam = z.infer<typeof fmLayoutParamSchema>;
export type FmSearchDto = z.infer<typeof fmSearchSchema>;

// ── Webhook DTOs ──

export const fmWebhookSchema = z.object({
  database: z.string().min(1),
  layout: z.string().min(1),
  recordId: z.string().min(1),
  action: z.enum(['create', 'update', 'delete']),
});

export type FmWebhookDto = z.infer<typeof fmWebhookSchema>;
