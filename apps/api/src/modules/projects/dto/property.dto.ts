import { z } from 'zod';

// ─── Select Options ─────────────────────────────────────────

const selectOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(80),
  color: z.string().max(20).default('#6B7280'),
});

// ─── Definitions ────────────────────────────────────────────

export const createPropertyDefinitionSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum([
    'TEXT',
    'NUMBER',
    'SELECT',
    'MULTI_SELECT',
    'DATE',
    'PERSON',
    'CHECKBOX',
    'URL',
  ]),
  options: z.array(selectOptionSchema).optional(),
  sortOrder: z.number().int().optional(),
  isRequired: z.boolean().default(false),
  isVisible: z.boolean().default(false),
  isFilterable: z.boolean().default(true),
});

export const updatePropertyDefinitionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  options: z.array(selectOptionSchema).nullable().optional(),
  isRequired: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
});

export const reorderPropertyDefinitionsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

// ─── Values ─────────────────────────────────────────────────

export const setPropertyValueSchema = z.object({
  textValue: z.string().max(5000).nullable().optional(),
  numberValue: z.number().nullable().optional(),
  dateValue: z.string().datetime().nullable().optional(),
  booleanValue: z.boolean().nullable().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  personUserId: z.string().uuid().nullable().optional(),
});

// ─── Type Inference ─────────────────────────────────────────

export type CreatePropertyDefinitionDto = z.infer<
  typeof createPropertyDefinitionSchema
>;
export type UpdatePropertyDefinitionDto = z.infer<
  typeof updatePropertyDefinitionSchema
>;
export type ReorderPropertyDefinitionsDto = z.infer<
  typeof reorderPropertyDefinitionsSchema
>;
export type SetPropertyValueDto = z.infer<typeof setPropertyValueSchema>;
