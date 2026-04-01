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
}
