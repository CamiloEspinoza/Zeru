"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import { useAuthContext } from "@/providers/auth-provider";

interface UseFieldLockOptions {
  entityType: string;
  entityId: string;
  fieldName: string;
  enabled?: boolean;
}

interface UseFieldLockResult {
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
  isLockedByMe: boolean;
  isLockedByOther: boolean;
  lockedByName: string | null;
}

export function useFieldLock({
  entityType,
  entityId,
  fieldName,
  enabled = true,
}: UseFieldLockOptions): UseFieldLockResult {
  const socket = useSocket();
  const [isLockedByMe, setIsLockedByMe] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { user } = useAuthContext();

  const lock = useProjectStore((s) =>
    entityId ? s.locks.get(`${entityType}:${entityId}:${fieldName}`) ?? null : null,
  );

  const myUserId = user?.id ?? null;

  const isLockedByOther = !!lock && lock.user.id !== myUserId;
  const lockedByName = isLockedByOther
    ? `${lock.user.firstName} ${lock.user.lastName}`.trim()
    : null;

  const acquire = useCallback(async (): Promise<boolean> => {
    if (!socket || !enabled) return false;
    return new Promise((resolve) => {
      const onAcquired = (data: { entityType: string; entityId: string; fieldName: string }) => {
        if (
          data.entityType === entityType &&
          data.entityId === entityId &&
          data.fieldName === fieldName
        ) {
          cleanup();
          setIsLockedByMe(true);
          resolve(true);
        }
      };
      const onDenied = (data: { entityType: string; entityId: string; fieldName: string }) => {
        if (
          data.entityType === entityType &&
          data.entityId === entityId &&
          data.fieldName === fieldName
        ) {
          cleanup();
          resolve(false);
        }
      };
      const cleanup = () => {
        socket.off("lock:acquired", onAcquired);
        socket.off("lock:denied", onDenied as (data: unknown) => void);
      };
      socket.on("lock:acquired", onAcquired);
      socket.on("lock:denied", onDenied as (data: unknown) => void);
      socket.emit("lock:acquire", { entityType, entityId, fieldName });

      // Timeout safety net
      setTimeout(() => {
        cleanup();
        resolve(false);
      }, 5000);
    });
  }, [socket, enabled, entityType, entityId, fieldName]);

  const release = useCallback(async (): Promise<void> => {
    if (!socket || !enabled) return;
    socket.emit("lock:release", { entityType, entityId, fieldName });
    setIsLockedByMe(false);
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, [socket, enabled, entityType, entityId, fieldName]);

  // Heartbeat while we hold the lock
  useEffect(() => {
    if (!isLockedByMe || !socket) return;

    heartbeatRef.current = setInterval(() => {
      socket.emit("lock:heartbeat", { entityType, entityId, fieldName });
    }, 30_000);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isLockedByMe, socket, entityType, entityId, fieldName]);

  // Release on unmount
  useEffect(() => {
    return () => {
      if (isLockedByMe && socket) {
        socket.emit("lock:release", { entityType, entityId, fieldName });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    acquire,
    release,
    isLockedByMe,
    isLockedByOther,
    lockedByName,
  };
}
