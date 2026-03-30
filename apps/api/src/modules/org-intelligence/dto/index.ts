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
  objective: z.string().max(2000).optional(),
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
  objective: z.string().max(2000).nullable().optional(),
});

export const updateSpeakerSchema = z.object({
  speakers: z.array(z.object({
    speakerLabel: z.string().min(1),
    name: z.string().optional(),
    role: z.string().optional(),
    department: z.string().optional(),
    isInterviewer: z.boolean().optional(),
    personEntityId: z.string().uuid().nullable().optional(),
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

// --- Department DTOs ---

export const createDepartmentSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(100),
  description: z.string().max(500).optional(),
  color: z.string().max(20).optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  parentId: z.string().uuid().nullable().optional(),
});

export const listDepartmentsSchema = z.object({
  search: z.string().optional(),
});

// --- PersonProfile DTOs ---

export const createPersonProfileSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido').max(200),
  role: z.string().max(200).optional(),
  departmentId: z.string().uuid().nullable().optional(),
  personType: z.enum(['INTERNAL', 'EXTERNAL', 'CONTRACTOR']).optional(),
  company: z.string().max(200).optional(),
  email: z.string().email('Email inválido').optional(),
  phone: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  reportsToId: z.string().uuid().nullable().optional(),
  employeeCode: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).optional(),
  source: z.enum(['MANUAL', 'AI_INFERRED', 'AI_CONFIRMED', 'CSV_IMPORT']).optional(),
});

export const updatePersonProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.string().max(200).nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  personType: z.enum(['INTERNAL', 'EXTERNAL', 'CONTRACTOR']).optional(),
  company: z.string().max(200).nullable().optional(),
  email: z.string().email('Email inválido').nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  reportsToId: z.string().uuid().nullable().optional(),
  employeeCode: z.string().max(100).nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).optional(),
  source: z.enum(['MANUAL', 'AI_INFERRED', 'AI_CONFIRMED', 'CSV_IMPORT']).optional(),
});

export const listPersonProfilesSchema = z.object({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'VACANT']).optional(),
  reportsToId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
});

export const updatePersonReportsToSchema = z.object({
  reportsToId: z.string().uuid().nullable(),
});

export const orgchartQuerySchema = z.object({
  rootId: z.string().uuid().optional(),
  depth: z.coerce.number().int().min(1).max(20).default(10),
});

// --- Type inference ---
export type CreateDepartmentDto = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDto = z.infer<typeof updateDepartmentSchema>;
export type ListDepartmentsDto = z.infer<typeof listDepartmentsSchema>;
export type CreateProjectDto = z.infer<typeof createProjectSchema>;
export type UpdateProjectDto = z.infer<typeof updateProjectSchema>;
export type ListProjectsDto = z.infer<typeof listProjectsSchema>;
export type CreateInterviewDto = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewDto = z.infer<typeof updateInterviewSchema>;
export type UpdateSpeakerDto = z.infer<typeof updateSpeakerSchema>;
export type ListInterviewsDto = z.infer<typeof listInterviewsSchema>;
export type CreateImprovementDto = z.infer<typeof createImprovementSchema>;
export type UpdateImprovementDto = z.infer<typeof updateImprovementSchema>;
export type CreatePersonProfileDto = z.infer<typeof createPersonProfileSchema>;
export type UpdatePersonProfileDto = z.infer<typeof updatePersonProfileSchema>;
export type ListPersonProfilesDto = z.infer<typeof listPersonProfilesSchema>;
export type UpdatePersonReportsToDto = z.infer<typeof updatePersonReportsToSchema>;
export type OrgchartQueryDto = z.infer<typeof orgchartQuerySchema>;
