import { z } from 'zod';
import { THEME_TOKEN_NAMES } from '../types/branding';

const hexColorRegex = /^#[0-9a-fA-F]{6}$/;
const oklchRegex = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+(\s*\/\s*[\d.]+%?)?\s*\)$/;

export const cssColorValue = z
  .string()
  .refine((v) => hexColorRegex.test(v) || oklchRegex.test(v), {
    message: 'Debe ser un color hex (#RRGGBB) o oklch()',
  });

const themeTokenKey = z.string().refine(
  (k) => (THEME_TOKEN_NAMES as readonly string[]).includes(k),
  { message: 'Nombre de token no valido' },
);

export const themeOverridesSchema = z
  .object({
    light: z.record(themeTokenKey, cssColorValue).optional(),
    dark: z.record(themeTokenKey, cssColorValue).optional(),
  })
  .optional();

export const updateBrandingSchema = z.object({
  primaryColor: z.string().regex(hexColorRegex, 'Color primario inválido').optional(),
  secondaryColor: z.string().regex(hexColorRegex, 'Color secundario inválido').optional(),
  accentColor: z.string().regex(hexColorRegex, 'Color de acento inválido').optional(),
  themeOverrides: themeOverridesSchema,
  borderRadius: z.enum(['sm', 'md', 'lg', 'xl']).optional(),
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

export const suggestColorSchema = z.object({
  description: z.string().min(3, 'Descripcion muy corta').max(300, 'Descripcion muy larga'),
});

export type UpdateBrandingSchema = z.infer<typeof updateBrandingSchema>;
export type GeneratePaletteSchema = z.infer<typeof generatePaletteSchema>;
export type SuggestColorSchema = z.infer<typeof suggestColorSchema>;
