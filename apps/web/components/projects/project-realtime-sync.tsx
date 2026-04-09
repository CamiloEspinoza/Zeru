"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { Task } from "@/types/projects";

interface ProjectRealtimeSyncProps {
  projectId: string;
}

export function ProjectRealtimeSync({ projectId }: ProjectRealtimeSyncProps) {
  const socket = useSocket();
  const upsertTask = useProjectStore((s) => s.upsertTask);
  const removeTask = useProjectStore((s) => s.removeTask);
  const patchTask = useProjectStore((s) => s.patchTask);

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit("project:join", { projectId });

    const handleCreated = (data: { projectId: string; task?: Task }) => {
      if (data.projectId !== projectId || !data.task) return;
      upsertTask(projectId, data.task);
    };

    const handleChanged = (data: {
      projectId: string;
      taskId: string;
      changes?: Record<string, { from: unknown; to: unknown }>;
    }) => {
      if (data.projectId !== projectId || !data.changes) return;
      const patch: Partial<Task> = {};
      for (const [key, change] of Object.entries(data.changes)) {
        (patch as Record<string, unknown>)[key] = change.to;
      }
      patchTask(projectId, data.taskId, patch);
    };

    const handleMoved = (data: {
      projectId: string;
      taskId: string;
      toSectionId?: string | null;
      position?: string;
      statusId?: string;
    }) => {
      if (data.projectId !== projectId) return;
      patchTask(projectId, data.taskId, {
        sectionId: data.toSectionId ?? undefined,
        position: data.position,
        statusId: data.statusId,
      } as Partial<Task>);
    };

    const handleRemoved = (data: { projectId: string; taskId: string }) => {
      if (data.projectId !== projectId) return;
      removeTask(projectId, data.taskId);
    };

    socket.on("task:created", handleCreated);
    socket.on("task:changed", handleChanged);
    socket.on("task:moved", handleMoved);
    socket.on("task:removed", handleRemoved);

    return () => {
      socket.emit("project:leave", { projectId });
      socket.off("task:created", handleCreated);
      socket.off("task:changed", handleChanged);
      socket.off("task:moved", handleMoved);
      socket.off("task:removed", handleRemoved);
    };
  }, [socket, projectId, upsertTask, removeTask, patchTask]);

  return null;
}
