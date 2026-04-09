import type {
  ChatSendPayload,
  ChatMessageEvent,
  ChatTypingPayload,
  ChatTypingEvent,
  ChatReadPayload,
  ChatReactPayload,
  ChatReactedEvent,
  ChatEditPayload,
  ChatEditedEvent,
  ChatDeletedEvent,
} from './chat';

// ─── Presence ────────────────────────────────────────────

export interface PresenceUser {
  userId: string;
  name: string;
  avatar: string | null;
  color: string;
}

export interface PresenceSnapshot {
  viewPath: string;
  users: PresenceUser[];
}

export interface PresenceUpdate {
  viewPath: string;
  event: 'joined' | 'left';
  user: PresenceUser;
  users: PresenceUser[];
}

export interface OnlineUsersUpdate {
  users: string[];
}

// ─── Locking ─────────────────────────────────────────────

export interface LockAcquirePayload {
  entityType: string;
  entityId: string;
  fieldName: string;
}

export interface LockDeniedPayload extends LockAcquirePayload {
  heldBy: PresenceUser;
}

export interface FieldLockedPayload extends LockAcquirePayload {
  user: PresenceUser;
}

export interface EntityUpdatedPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  value: unknown;
  version: number;
  updatedBy: PresenceUser | { actorType: 'SYSTEM' | 'AI' | 'WEBHOOK' };
}

export interface EntityConflictPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  currentValue: unknown;
  currentVersion: number;
}

export interface LockForceReleasedPayload extends LockAcquirePayload {
  reason: string;
}

// ─── WebSocket Event Maps ────────────────────────────────

export interface ClientToServerEvents {
  'presence:join': (data: { viewPath: string }) => void;
  'presence:leave': (data: { viewPath: string }) => void;
  'presence:heartbeat': () => void;
  'lock:acquire': (data: LockAcquirePayload) => void;
  'lock:release': (data: LockAcquirePayload) => void;
  'lock:heartbeat': (data: LockAcquirePayload) => void;
  'chat:send': (data: ChatSendPayload) => void;
  'chat:typing': (data: ChatTypingPayload) => void;
  'chat:read': (data: ChatReadPayload) => void;
  'chat:react': (data: ChatReactPayload) => void;
  'chat:edit': (data: ChatEditPayload) => void;
  'chat:delete': (data: { messageId: string }) => void;
  'channel:join': (data: { channelId: string }) => void;
  'channel:leave': (data: { channelId: string }) => void;
  'project:join': (data: { projectId: string }) => void;
  'project:leave': (data: { projectId: string }) => void;
}

export interface ServerToClientEvents {
  'presence:snapshot': (data: PresenceSnapshot) => void;
  'presence:update': (data: PresenceUpdate) => void;
  'presence:online': (data: OnlineUsersUpdate) => void;
  'lock:acquired': (data: LockAcquirePayload) => void;
  'lock:denied': (data: LockDeniedPayload) => void;
  'lock:field-locked': (data: FieldLockedPayload) => void;
  'lock:field-unlocked': (data: LockAcquirePayload) => void;
  'lock:force-released': (data: LockForceReleasedPayload) => void;
  'entity:updated': (data: EntityUpdatedPayload) => void;
  'entity:conflict': (data: EntityConflictPayload) => void;
  'notification:new': (data: {
    id: string;
    type: string;
    title: string;
    body?: string;
    data: Record<string, unknown>;
  }) => void;
  'notification:count': (data: { unread: number }) => void;
  'chat:message': (data: ChatMessageEvent) => void;
  'chat:typing': (data: ChatTypingEvent) => void;
  'chat:typing:stop': (data: ChatTypingEvent) => void;
  'chat:read': (data: { channelId: string; userId: string; sequence: string }) => void;
  'chat:reacted': (data: ChatReactedEvent) => void;
  'chat:edited': (data: ChatEditedEvent) => void;
  'chat:deleted': (data: ChatDeletedEvent) => void;
  'task:created': (data: {
    projectId: string;
    task: Record<string, unknown>;
    sectionId?: string | null;
    position?: string;
    actorId?: string;
  } & Record<string, unknown>) => void;
  'task:changed': (data: {
    projectId: string;
    taskId: string;
    changes?: Record<string, { from: unknown; to: unknown } | unknown>;
    version?: number;
    actorId?: string;
    updatedBy?: PresenceUser;
  } & Record<string, unknown>) => void;
  'task:moved': (data: {
    projectId: string;
    taskId: string;
    fromSectionId?: string | null;
    toSectionId?: string | null;
    position?: string;
    actorId?: string;
    movedBy?: PresenceUser;
  } & Record<string, unknown>) => void;
  'task:removed': (data: {
    projectId: string;
    taskId: string;
    actorId?: string;
  } & Record<string, unknown>) => void;
  'task:comment:new': (data: {
    projectId: string;
    taskId: string;
    comment?: Record<string, unknown>;
    commentId?: string;
    actorId?: string;
  } & Record<string, unknown>) => void;
  'section:changed': (data: {
    projectId: string;
    sectionId: string | null;
    action?: 'created' | 'updated' | 'deleted' | 'reordered';
    changes?: Record<string, unknown>;
  } & Record<string, unknown>) => void;
}
