import { z } from 'zod';

export const upsertStorageConfigSchema = z.object({
  region: z.string().min(1, 'Región requerida'),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  bucket: z.string().min(1, 'Bucket requerido'),
});

export const validateStorageConfigSchema = z.object({
  region: z.string().min(1, 'Región requerida'),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  bucket: z.string().min(1, 'Bucket requerido'),
});

export type UpsertStorageConfigDto = z.infer<typeof upsertStorageConfigSchema>;
export type ValidateStorageConfigDto = z.infer<typeof validateStorageConfigSchema>;
