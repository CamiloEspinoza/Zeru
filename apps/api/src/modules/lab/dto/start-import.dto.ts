import { z } from 'zod';

export const startImportSchema = z.object({
  sources: z
    .array(z.enum(['BIOPSIAS', 'BIOPSIASRESPALDO', 'PAPANICOLAOU', 'PAPANICOLAOUHISTORICO']))
    .min(1),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  batchSize: z.number().int().min(10).max(500).optional(),
});

export type StartImportDto = z.infer<typeof startImportSchema>;
