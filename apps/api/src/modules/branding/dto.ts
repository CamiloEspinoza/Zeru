import { z } from 'zod';
import { THEME_TOKEN_NAMES } from '@zeru/shared';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const oklchRegex = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+%?)?\s*\)$/;

const cssColorValue = z
  .string()
  .refine((v) => hexColorRegex.test(v) || oklchRegex.test(v), {
    message: 'Debe ser un color hex (#RRGGBB) o oklch()',
  });

const themeTokenKey = z.string().refine(
  (k) => (THEME_TOKEN_NAMES as readonly string[]).includes(k),
  { message: 'Nombre de token no valido' },
);

const themeOverridesDto = z
  .object({
    light: z.record(themeTokenKey, cssColorValue).optional(),
    dark: z.record(themeTokenKey, cssColorValue).optional(),
  })
  .optional();

export const updateBrandingDto = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario invalido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario invalido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento invalido').optional(),
  themeOverrides: themeOverridesDto,
  borderRadius: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
});

export const generatePaletteDto = z.discriminatedUnion('source', [
  z.object({ source: z.literal('logo') }),
  z.object({
    source: z.literal('description'),
    description: z.string().min(5, 'Descripcion muy corta').max(500, 'Descripcion muy larga'),
  }),
]);

export const suggestColorDto = z.object({
  description: z.string().min(3, 'Descripcion muy corta').max(300, 'Descripcion muy larga'),
});

export type UpdateBrandingDto = z.infer<typeof updateBrandingDto>;
export type GeneratePaletteDto = z.infer<typeof generatePaletteDto>;
export type SuggestColorDto = z.infer<typeof suggestColorDto>;
