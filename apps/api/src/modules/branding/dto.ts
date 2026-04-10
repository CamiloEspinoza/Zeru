import { z } from 'zod';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;

export const updateBrandingDto = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario invalido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario invalido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento invalido').optional(),
});

export const generatePaletteDto = z.discriminatedUnion('source', [
  z.object({ source: z.literal('logo') }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
  }),
]);

export type UpdateBrandingDto = z.infer<typeof updateBrandingDto>;
export type GeneratePaletteDto = z.infer<typeof generatePaletteDto>;
