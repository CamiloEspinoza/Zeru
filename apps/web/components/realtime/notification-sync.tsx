"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useRealtimeStore } from "@/stores/realtime-store";

export function NotificationSync() {
  const socket = useSocket();
  const { addNotification, setUnreadCount } = useRealtimeStore();

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
