import { z } from 'zod';

export const startImportSchema = z.object({
  sources: z
    .array(z.enum(['BIOPSIAS', 'BIOPSIASRESPALDO', 'PAPANICOLAOU', 'PAPANICOLAOUHISTORICO']))
    .min(1),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  batchSize: z.coerce.number().int().min(10).max(500).optional(),
}).refine(
  (d) => !d.dateFrom || !d.dateTo || new Date(d.dateTo) >= new Date(d.dateFrom),
  { message: 'dateTo must be >= dateFrom', path: ['dateTo'] },
).refine(
  (d) => {
    if (!d.dateFrom || !d.dateTo) return true;
    const diffMs = new Date(d.dateTo).getTime() - new Date(d.dateFrom).getTime();
    return diffMs <= 366 * 24 * 60 * 60 * 1000;
  },
  { message: 'Date range cannot exceed 1 year', path: ['dateTo'] },
);

export type StartImportDto = z.infer<typeof startImportSchema>;
