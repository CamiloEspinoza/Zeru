export type ChannelType = 'PUBLIC' | 'PRIVATE' | 'DM' | 'GROUP_DM';

export interface Channel {
  id: string;
  name: string | null;
  slug: string | null;
  type: ChannelType;
  topic: string | null;
  description: string | null;
  lastSequence: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  tenantId: string;
  createdById: string;
  memberCount?: number;
  unreadCount?: number;
}

export interface ChannelMember {
  id: string;
  role: string;
  lastReadSequence: string;
  isMuted: boolean;
  joinedAt: string;
  channelId: string;
  userId: string;
  user?: { id: string; firstName: string; lastName: string; email: string };
}

export interface ChatMessage {
  id: string;
  content: string;
  sequence: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  channelId: string;
  authorId: string;
  author?: { id: string; firstName: string; lastName: string; email: string };
  threadParentId: string | null;
  threadReplyCount: number;
  lastThreadReplyAt: string | null;
  reactions?: ChatReaction[];
  mentions?: ChatMention[];
}

export interface ChatReaction {
  id: string;
  emoji: string;
  messageId: string;
  userId: string;
}

export interface ChatMention {
  id: string;
  messageId: string;
  mentionedUserId: string;
}

export interface ChatSendPayload {
  channelId: string;
  content: string;
  threadParentId?: string;
  mentions?: string[];
}

export interface ChatMessageEvent {
  id: string;
  channelId: string;
  sequence: string;
  content: string;
  author: { id: string; firstName: string; lastName: string };
  createdAt: string;
  threadParentId: string | null;
}

export interface ChatTypingPayload {
  channelId: string;
}

export interface ChatTypingEvent {
  channelId: string;
  userId: string;
  userName: string;
}

export interface ChatReadPayload {
  channelId: string;
  sequence: string;
}

export interface ChatReactPayload {
  messageId: string;
  emoji: string;
}

export interface ChatReactedEvent {
  messageId: string;
  emoji: string;
  userId: string;
  action: 'added' | 'removed';
}

export interface ChatEditPayload {
  messageId: string;
  content: string;
}

export interface ChatEditedEvent {
  messageId: string;
  content: string;
  editedAt: string;
}

export interface ChatDeletedEvent {
  messageId: string;
}
