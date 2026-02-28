import { z } from 'zod';

export const upsertStorageConfigSchema = z.object({
  region: z.string().min(1, 'Región requerida'),
  accessKeyId: z.string().min(1, 'Access Key ID requerido'),
  secretAccessKey: z.string().min(1, 'Secret Access Key requerido'),
  bucket: z.string().min(1, 'Bucket requerido'),
});

export const validateStorageConfigSchema = upsertStorageConfigSchema;

export type UpsertStorageConfigDto = z.infer<typeof upsertStorageConfigSchema>;
export type ValidateStorageConfigDto = z.infer<typeof validateStorageConfigSchema>;
