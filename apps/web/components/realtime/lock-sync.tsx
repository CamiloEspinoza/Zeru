"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore, type FieldLock } from "@/stores/project-store";

interface LockEventPayload {
  entityType: string;
  entityId: string;
  fieldName: string;
  userId: string;
  socketId?: string;
  expiresAt?: string;
  user?: {
    userId: string;
    name: string;
    avatar: string | null;
    color: string;
  };
}

export function LockSync() {
  const socket = useSocket();
  const setLock = useProjectStore((s) => s.setLock);
  const removeLock = useProjectStore((s) => s.removeLock);

  useEffect(() => {
    if (!socket) return;

    const handleLocked = (data: LockEventPayload) => {
      if (!data.user) return;
      const lock: FieldLock = {
        entityType: data.entityType,
        entityId: data.entityId,
        fieldName: data.fieldName,
        user: {
          id: data.user.userId,
          firstName: data.user.name.split(" ")[0] ?? data.user.name,
          lastName: data.user.name.split(" ").slice(1).join(" ") || "",
          color: data.user.color,
        } as FieldLock["user"],
      };
      setLock(lock);
    };

    const handleUnlocked = (data: LockEventPayload) => {
      removeLock(data.entityType, data.entityId, data.fieldName);
    };

    // Gateway emits these without the `lock:` prefix
    socket.on("field:locked" as "lock:field-locked", handleLocked as (data: unknown) => void);
    socket.on("field:unlocked" as "lock:field-unlocked", handleUnlocked as (data: unknown) => void);

    return () => {
      socket.off("field:locked" as "lock:field-locked", handleLocked as (data: unknown) => void);
      socket.off("field:unlocked" as "lock:field-unlocked", handleUnlocked as (data: unknown) => void);
    };
  }, [socket, setLock, removeLock]);

  return null;
}
