"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceSnapshot, PresenceUpdate } from "@zeru/shared";

export function useTaskPresence(projectId: string | null, taskId: string | null) {
  const socket = useSocket();
  const setViewUsers = usePresenceStore((s) => s.setViewUsers);

  useEffect(() => {
    if (!socket || !projectId || !taskId) return;

    const viewPath = `/projects/${projectId}/task/${taskId}`;
    socket.emit("presence:join", { viewPath });

    const handleSnapshot = (data: PresenceSnapshot) => {
      if (data.viewPath === viewPath) setViewUsers(viewPath, data.users);
    };
    const handleUpdate = (data: PresenceUpdate) => {
      if (data.viewPath === viewPath) setViewUsers(viewPath, data.users);
    };

    socket.on("presence:snapshot", handleSnapshot);
    socket.on("presence:update", handleUpdate);

    return () => {
      socket.emit("presence:leave", { viewPath });
      socket.off("presence:snapshot", handleSnapshot);
      socket.off("presence:update", handleUpdate);
    };
  }, [socket, projectId, taskId, setViewUsers]);
}
