"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSocket } from "@/hooks/use-socket";
import { usePresenceStore } from "@/stores/presence-store";
import type {
  PresenceSnapshot,
  PresenceUpdate,
  OnlineUsersUpdate,
} from "@zeru/shared";

export function PresenceSync() {
  const pathname = usePathname();
  const socket = useSocket();
  const { setOnlineUsers, setViewUsers } = usePresenceStore();

  useEffect(() => {
    if (!socket) return;

    const handleOnline = (data: OnlineUsersUpdate) => {
      setOnlineUsers(data.users);
    };

    socket.on("presence:online", handleOnline);
    return () => {
      socket.off("presence:online", handleOnline);
    };
  }, [socket, setOnlineUsers]);

  useEffect(() => {
    if (!socket || !pathname) return;

    socket.emit("presence:join", { viewPath: pathname });

    const handleSnapshot = (data: PresenceSnapshot) => {
      if (data.viewPath === pathname) {
        setViewUsers(pathname, data.users);
      }
    };

    const handleUpdate = (data: PresenceUpdate) => {
      if (data.viewPath === pathname) {
        setViewUsers(pathname, data.users);
      }
    };

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);

    return () => {
      socket.emit("presence:leave", { viewPath: pathname });
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket, pathname, setViewUsers]);

  useEffect(() => {
    if (!socket) return;

    const interval = setInterval(() => {
      socket.emit("presence:heartbeat");
    }, 30_000);

    return () => clearInterval(interval);
  }, [socket]);

  return null;
}
