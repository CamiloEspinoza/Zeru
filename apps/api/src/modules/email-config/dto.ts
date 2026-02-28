import { z } from 'zod';

export const upsertEmailConfigSchema = z.object({
  region: z.string().min(1, 'Región requerida'),
  accessKeyId: z.string().min(1, 'Access Key ID requerido'),
  secretAccessKey: z.string().min(1, 'Secret Access Key requerido'),
  fromEmail: z.string().email('Email de envío inválido'),
});

export const validateEmailConfigSchema = upsertEmailConfigSchema;

export type UpsertEmailConfigDto = z.infer<typeof upsertEmailConfigSchema>;
export type ValidateEmailConfigDto = z.infer<typeof validateEmailConfigSchema>;
