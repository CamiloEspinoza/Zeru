import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario inválido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario inválido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento inválido').optional(),
});

export const generatePaletteSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('logo'),
  }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripción muy corta').max(500, 'Descripción muy larga'),
  }),
]);

export type UpdateBrandingSchema = z.infer<typeof updateBrandingSchema>;
export type GeneratePaletteSchema = z.infer<typeof generatePaletteSchema>;
