"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useRealtimeStore } from "@/stores/realtime-store";
import { api } from "@/lib/api-client";
import { toast } from "sonner";
import type { Notification } from "@zeru/shared";

export function NotificationSync() {
  const socket = useSocket();
  const { addNotification, setNotifications, setUnreadCount } =
    useRealtimeStore();
  const didLoadRef = useRef(false);

  // ─── Initial load on mount / socket connect ──────────────
  useEffect(() => {
    if (didLoadRef.current) return;
    didLoadRef.current = true;

    (async () => {
      try {
        const [listRes, countRes] = await Promise.all([
          api.get<{ items: Notification[] }>("/notifications?limit=20"),
          api.get<{ unread: number }>("/notifications/unread-count"),
        ]);
        setNotifications(listRes.items);
        setUnreadCount(countRes.unread);
      } catch {
        // silently ignore — will retry on next mount
      }
    })();
  }, [setNotifications, setUnreadCount]);

  // ─── Real-time socket handlers ───────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNew = (data: {
      id: string;
      type: string;
      title: string;
      body?: string;
      data: Record<string, unknown>;
    }) => {
      addNotification({
        ...data,
        body: data.body ?? null,
        isRead: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      });

      // F1: Toast popup for real-time notifications
      toast(data.title, {
        description: data.body ?? undefined,
        duration: 5000,
      });
    };

    const handleCount = (data: { unread: number }) => {
      setUnreadCount(data.unread);
    };

    socket.on("notification:new", handleNew);
    socket.on("notification:count", handleCount);

    return () => {
      socket.off("notification:new", handleNew);
      socket.off("notification:count", handleCount);
    };
  }, [socket, addNotification, setUnreadCount]);

  return null;
}
