import { z } from 'zod';
import { USER_ROLES } from '../constants';

export const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  role: z.enum(USER_ROLES).optional(),
});

export const updateUserSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});

export const updateMembershipSchema = z.object({
  role: z.enum(USER_ROLES),
});

export const linkPersonSchema = z.object({
  personProfileId: z.string().uuid('ID de perfil inválido'),
});

export type CreateUserSchema = z.infer<typeof createUserSchema>;
export type UpdateUserSchema = z.infer<typeof updateUserSchema>;
export type UpdateMembershipSchema = z.infer<typeof updateMembershipSchema>;
export type LinkPersonSchema = z.infer<typeof linkPersonSchema>;
