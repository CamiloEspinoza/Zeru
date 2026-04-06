import { z } from 'zod';

// ─── Projects ────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(5000).optional(),
  key: z.string().min(1).max(10).regex(/^[A-Z0-9]+$/, 'Solo letras mayúsculas y números'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).optional(),
  color: z.string().max(20).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const listProjectsSchema = z.object({
  status: z.enum(['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'dueDate']).default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ─── Members ─────────────────────────────────────────────

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});

// ─── Sections ────────────────────────────────────────────

export const createSectionSchema = z.object({
  name: z.string().min(1).max(100),
});

export const updateSectionSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderSectionsSchema = z.object({
  sectionIds: z.array(z.string().uuid()).min(1),
});

// ─── Status Configs ──────────────────────────────────────

export const createStatusConfigSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9_-]+$/),
  color: z.string().max(20).optional(),
  category: z.enum(['backlog', 'active', 'done', 'cancelled']).default('active'),
});

export const updateStatusConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  category: z.enum(['backlog', 'active', 'done', 'cancelled']).optional(),
  sortOrder: z.number().int().optional(),
});

// ─── Labels ──────────────────────────────────────────────

export const createLabelSchema = z.object({
  name: z.string().min(1).max(50),
  color: z.string().max(20).default('#6B7280'),
});

export const updateLabelSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  color: z.string().max(20).optional(),
});

// ─── Views ───────────────────────────────────────────────

export const createViewSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['BOARD', 'LIST', 'TIMELINE', 'CALENDAR']).default('BOARD'),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: z.record(z.unknown()).optional(),
  filters: z.record(z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

export const reorderStatusesSchema = z.object({
  statusIds: z.array(z.string().uuid()).min(1),
});

// ─── Type Inference ──────────────────────────────────────

export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
export type CreateSectionDto = z.infer<typeof createSectionSchema>;
export type UpdateSectionDto = z.infer<typeof updateSectionSchema>;
export type CreateStatusConfigDto = z.infer<typeof createStatusConfigSchema>;
export type UpdateStatusConfigDto = z.infer<typeof updateStatusConfigSchema>;
export type CreateLabelDto = z.infer<typeof createLabelSchema>;
export type UpdateLabelDto = z.infer<typeof updateLabelSchema>;
export type CreateViewDto = z.infer<typeof createViewSchema>;
export type UpdateViewDto = z.infer<typeof updateViewSchema>;
export type ReorderSectionsDto = z.infer<typeof reorderSectionsSchema>;
export type ReorderStatusesDto = z.infer<typeof reorderStatusesSchema>;
