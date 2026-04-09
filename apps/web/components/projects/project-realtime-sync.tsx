"use client";

import { useEffect } from "react";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { Task, TaskComment } from "@/types/projects";

interface ProjectRealtimeSyncProps {
  projectId: string;
  onSectionChanged?: () => void;
}

export function ProjectRealtimeSync({
  projectId,
  onSectionChanged,
}: ProjectRealtimeSyncProps) {
  const socket = useSocket();
  const upsertTask = useProjectStore((s) => s.upsertTask);
  const removeTask = useProjectStore((s) => s.removeTask);
  const patchTask = useProjectStore((s) => s.patchTask);

  useEffect(() => {
    if (!socket || !projectId) return;

    // Initial join
    socket.emit("project:join", { projectId });

    // Re-join on reconnect
    const handleConnect = () => {
      socket.emit("project:join", { projectId });
    };

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
      const patch: Partial<Task> = {};
      if (data.toSectionId !== undefined) patch.sectionId = data.toSectionId;
      if (data.position !== undefined) patch.position = data.position;
      if (data.statusId !== undefined) patch.statusId = data.statusId;
      if (Object.keys(patch).length > 0) patchTask(projectId, data.taskId, patch);
    };

    const handleRemoved = (data: { projectId: string; taskId: string }) => {
      if (data.projectId !== projectId) return;
      removeTask(projectId, data.taskId);
    };

    const handleCommentNew = (data: {
      projectId: string;
      taskId: string;
      comment?: TaskComment;
    }) => {
      if (data.projectId !== projectId || !data.comment) return;
      useProjectStore.getState().addComment(data.taskId, data.comment);
    };

    const handleCommentUpdated = (data: {
      projectId: string;
      taskId: string;
      commentId: string;
      comment: Partial<TaskComment>;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore.getState().updateComment(data.taskId, data.commentId, data.comment);
    };

    const handleCommentDeleted = (data: {
      projectId: string;
      taskId: string;
      commentId: string;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore.getState().removeComment(data.taskId, data.commentId);
    };

    const handleReactionAdded = (data: {
      projectId: string;
      taskId: string;
      commentId: string;
      emoji: string;
      userId: string;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore
        .getState()
        .addCommentReaction(data.taskId, data.commentId, data.emoji, data.userId);
    };

    const handleReactionRemoved = (data: {
      projectId: string;
      taskId: string;
      commentId: string;
      emoji: string;
      userId: string;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore
        .getState()
        .removeCommentReaction(data.taskId, data.commentId, data.emoji, data.userId);
    };

    const handleCommentTyping = (data: {
      projectId: string;
      taskId: string;
      userId: string;
      userName: string;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore.getState().setTypingUser(data.taskId, {
        userId: data.userId,
        userName: data.userName,
        startedAt: Date.now(),
      });
      // Auto-clear after 3 seconds if no new typing event
      setTimeout(() => {
        const current = useProjectStore.getState().typingByTask.get(data.taskId)?.get(data.userId);
        if (current && Date.now() - current.startedAt >= 2900) {
          useProjectStore.getState().clearTypingUser(data.taskId, data.userId);
        }
      }, 3000);
    };

    const handleCommentTypingStop = (data: {
      projectId: string;
      taskId: string;
      userId: string;
    }) => {
      if (data.projectId !== projectId) return;
      useProjectStore.getState().clearTypingUser(data.taskId, data.userId);
    };

    const handleSectionChanged = (data: { projectId: string }) => {
      if (data.projectId !== projectId) return;
      onSectionChanged?.();
    };

    socket.on("connect", handleConnect);
    socket.on("task:created", handleCreated);
    socket.on("task:changed", handleChanged);
    socket.on("task:moved", handleMoved);
    socket.on("task:removed", handleRemoved);
    socket.on("task:comment:new", handleCommentNew as (data: unknown) => void);
    socket.on("task:comment:updated", handleCommentUpdated as (data: unknown) => void);
    socket.on("task:comment:deleted", handleCommentDeleted as (data: unknown) => void);
    socket.on("task:comment:reaction:added", handleReactionAdded as (data: unknown) => void);
    socket.on("task:comment:reaction:removed", handleReactionRemoved as (data: unknown) => void);
    socket.on("task:comment:typing", handleCommentTyping as (data: unknown) => void);
    socket.on("task:comment:typing:stop", handleCommentTypingStop as (data: unknown) => void);
    socket.on("section:changed", handleSectionChanged as (data: unknown) => void);

    return () => {
      socket.emit("project:leave", { projectId });
      socket.off("connect", handleConnect);
      socket.off("task:created", handleCreated);
      socket.off("task:changed", handleChanged);
      socket.off("task:moved", handleMoved);
      socket.off("task:removed", handleRemoved);
      socket.off("task:comment:new", handleCommentNew as (data: unknown) => void);
      socket.off("task:comment:updated", handleCommentUpdated as (data: unknown) => void);
      socket.off("task:comment:deleted", handleCommentDeleted as (data: unknown) => void);
      socket.off("task:comment:reaction:added", handleReactionAdded as (data: unknown) => void);
      socket.off("task:comment:reaction:removed", handleReactionRemoved as (data: unknown) => void);
      socket.off("task:comment:typing", handleCommentTyping as (data: unknown) => void);
      socket.off("task:comment:typing:stop", handleCommentTypingStop as (data: unknown) => void);
      socket.off("section:changed", handleSectionChanged as (data: unknown) => void);
    };
  }, [socket, projectId, upsertTask, removeTask, patchTask, onSectionChanged]);

  return null;
}
