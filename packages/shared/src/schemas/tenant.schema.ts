import { z } from 'zod';

export const createTenantSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Solo minúsculas, números y guiones'),
  rut: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  rut: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export type CreateTenantSchema = z.infer<typeof createTenantSchema>;
export type UpdateTenantSchema = z.infer<typeof updateTenantSchema>;
