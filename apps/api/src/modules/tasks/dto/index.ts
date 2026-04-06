import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().min(1, 'El titulo es requerido').max(500),
  description: z.string().max(50000).optional(),
  projectId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
  parentId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).default('NONE'),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  estimate: z.number().positive().optional(),
  estimateUnit: z.enum(['POINTS', 'MINUTES', 'HOURS']).optional(),
  labelIds: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(50000).nullable().optional(),
  statusId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  sectionId: z.string().uuid().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimate: z.number().positive().nullable().optional(),
  estimateUnit: z.enum(['POINTS', 'MINUTES', 'HOURS']).nullable().optional(),
});

export const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  statusId: z.string().uuid().optional(),
  priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
  assigneeId: z.string().uuid().optional(),
  sectionId: z.string().uuid().optional(),
  parentId: z.string().uuid().nullable().optional(),
  labelIds: z.string().optional(),
  search: z.string().max(200).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z
    .enum(['position', 'createdAt', 'updatedAt', 'dueDate', 'priority', 'title'])
    .default('position'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const myTasksSchema = z.object({
  status: z.string().optional(),
  dueWithinDays: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
});

export const moveTaskSchema = z.object({
  sectionId: z.string().uuid().nullable().optional(),
  position: z.string().min(1),
  statusId: z.string().uuid().optional(),
});

export const bulkUpdateTasksSchema = z.object({
  taskIds: z.array(z.string().uuid()).min(1).max(50),
  update: z.object({
    statusId: z.string().uuid().optional(),
    priority: z.enum(['URGENT', 'HIGH', 'MEDIUM', 'LOW', 'NONE']).optional(),
    assigneeId: z.string().uuid().nullable().optional(),
    sectionId: z.string().uuid().nullable().optional(),
    dueDate: z.string().datetime().nullable().optional(),
  }),
});

export const createCommentSchema = z.object({
  content: z.string().min(1).max(10000),
  parentId: z.string().uuid().optional(),
  mentionedUserIds: z.array(z.string().uuid()).optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(10000),
});

export const createDependencySchema = z.object({
  dependsOnId: z.string().uuid(),
  dependencyType: z.enum(['BLOCKS', 'RELATES_TO', 'DUPLICATES']).default('BLOCKS'),
});

export const activityQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// Type inference
export type CreateTaskDto = z.infer<typeof createTaskSchema>;
export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
export type ListTasksDto = z.infer<typeof listTasksSchema>;
export type MyTasksDto = z.infer<typeof myTasksSchema>;
export type MoveTaskDto = z.infer<typeof moveTaskSchema>;
export type BulkUpdateTasksDto = z.infer<typeof bulkUpdateTasksSchema>;
export type CreateCommentDto = z.infer<typeof createCommentSchema>;
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
export type CreateDependencyDto = z.infer<typeof createDependencySchema>;
export type ActivityQueryDto = z.infer<typeof activityQuerySchema>;
