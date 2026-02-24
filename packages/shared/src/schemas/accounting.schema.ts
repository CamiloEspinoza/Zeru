import { z } from 'zod';
import { ACCOUNT_TYPES } from '../constants';

export const createAccountSchema = z.object({
  code: z.string().min(1, 'Código requerido'),
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  type: z.enum(ACCOUNT_TYPES),
  parentId: z.string().uuid().optional(),
});

export const updateAccountSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

const journalEntryLineSchema = z.object({
  accountId: z.string().uuid('Cuenta requerida'),
  debit: z.number().min(0, 'Debe ser >= 0'),
  credit: z.number().min(0, 'Debe ser >= 0'),
  description: z.string().optional(),
});

export const createJournalEntrySchema = z.object({
  date: z.string().date('Fecha inválida'),
  description: z.string().min(1, 'Descripción requerida'),
  fiscalPeriodId: z.string().uuid('Período fiscal requerido'),
  lines: z
    .array(journalEntryLineSchema)
    .min(2, 'Mínimo 2 líneas')
    .refine(
      (lines) => {
        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        return Math.abs(totalDebit - totalCredit) < 0.01;
      },
      { message: 'Debe y Haber deben ser iguales' },
    ),
});

export const createFiscalPeriodSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  startDate: z.string().date('Fecha inicio inválida'),
  endDate: z.string().date('Fecha fin inválida'),
});

export type CreateAccountSchema = z.infer<typeof createAccountSchema>;
export type UpdateAccountSchema = z.infer<typeof updateAccountSchema>;
export type CreateJournalEntrySchema = z.infer<typeof createJournalEntrySchema>;
export type CreateFiscalPeriodSchema = z.infer<typeof createFiscalPeriodSchema>;

// ─── Process Steps ───────────────────────────────────────────────

const STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED'] as const;

export const createProcessStepSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  description: z.string().optional(),
  order: z.number().int().min(0),
});

export const updateProcessStepSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).optional(),
});

export const updateStepCompletionSchema = z.object({
  fiscalPeriodId: z.string().uuid('Período fiscal requerido'),
  status: z.enum(STEP_STATUSES),
  notes: z.string().optional(),
});

export const reorderStepsSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().min(0),
    }),
  ),
});

export type CreateProcessStepSchema = z.infer<typeof createProcessStepSchema>;
export type UpdateProcessStepSchema = z.infer<typeof updateProcessStepSchema>;
export type UpdateStepCompletionSchema = z.infer<typeof updateStepCompletionSchema>;
export type ReorderStepsSchema = z.infer<typeof reorderStepsSchema>;
