import { z } from 'zod';

// --- OrgProject DTOs ---

export const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  config: z.record(z.unknown()).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
  config: z.record(z.unknown()).nullable().optional(),
});

export const listProjectsSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

// --- Interview DTOs ---

export const createInterviewSchema = z.object({
  projectId: z.string().uuid('ID de proyecto invalido'),
  title: z.string().max(200).optional(),
  interviewDate: z.string().datetime().optional(),
  speakers: z.array(z.object({
    speakerLabel: z.string().min(1),
    name: z.string().optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    isInterviewer: z.boolean().default(false),
  })).optional(),
});

export const updateInterviewSchema = z.object({
  title: z.string().max(200).optional(),
  interviewDate: z.string().datetime().nullable().optional(),
});

export const updateSpeakerSchema = z.object({
  speakers: z.array(z.object({
    speakerLabel: z.string().min(1),
    name: z.string().optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    isInterviewer: z.boolean().optional(),
  })),
});

export const listInterviewsSchema = z.object({
  projectId: z.string().uuid(),
  processingStatus: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

// --- Improvement DTOs ---

export const createImprovementSchema = z.object({
  title: z.string().min(1, 'El titulo es requerido').max(200),
  description: z.string().min(1, 'La descripcion es requerida').max(5000),
  type: z.string().max(100).optional(),
  effort: z.string().max(100).optional(),
  impact: z.string().max(100).optional(),
  priority: z.number().int().optional(),
  projectId: z.string().uuid('ID de proyecto invalido'),
  problemId: z.string().uuid('ID de problema invalido'),
});

export const updateImprovementSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(5000).optional(),
  type: z.string().max(100).nullable().optional(),
  effort: z.string().max(100).nullable().optional(),
  impact: z.string().max(100).nullable().optional(),
  priority: z.number().int().nullable().optional(),
  status: z.string().max(50).optional(),
});

// --- Type inference ---
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type CreateInterviewDto = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewDto = z.infer<typeof updateInterviewSchema>;
export type UpdateSpeakerDto = z.infer<typeof updateSpeakerSchema>;
export type ListInterviewsDto = z.infer<typeof listInterviewsSchema>;
export type CreateImprovementDto = z.infer<typeof createImprovementSchema>;
export type UpdateImprovementDto = z.infer<typeof updateImprovementSchema>;
