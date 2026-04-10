import { z } from 'zod';

export const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(['PUBLIC', 'PRIVATE']),
  topic: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  memberIds: z.array(z.string().uuid()).optional(),
});

export const createDmSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(8),
});

export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  direction: z.enum(['before', 'after']).default('before'),
});

export const searchMessagesSchema = z.object({
  query: z.string().min(1).max(200),
  channelId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
export type CreateDmDto = z.infer<typeof createDmSchema>;
export type MessagesQueryDto = z.infer<typeof messagesQuerySchema>;
export type SearchMessagesDto = z.infer<typeof searchMessagesSchema>;
