import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  firstName: z.string().min(2, 'Mínimo 2 caracteres'),
  lastName: z.string().min(2, 'Mínimo 2 caracteres'),
  tenantName: z.string().min(2, 'Mínimo 2 caracteres'),
});

export const sendCodeSchema = z.object({
  email: z.string().email('Email inválido'),
});

export const verifyCodeSchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().length(6).regex(/^\d{6}$/, 'El código debe tener 6 dígitos'),
  tenantId: z.string().uuid().optional(),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type SendCodeSchema = z.infer<typeof sendCodeSchema>;
export type VerifyCodeSchema = z.infer<typeof verifyCodeSchema>;
