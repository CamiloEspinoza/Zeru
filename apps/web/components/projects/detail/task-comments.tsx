"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { TaskComment } from "@/types/projects";

const EMPTY_COMMENTS: TaskComment[] = [];
import { tasksApi } from "@/lib/api/tasks";
import { TaskCommentTyping } from "./task-comment-typing";

interface TaskCommentsProps {
  taskId: string;
  projectId: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

export function TaskComments({ taskId, projectId }: TaskCommentsProps) {
  const socket = useSocket();
  const setComments = useProjectStore((s) => s.setComments);
  const comments = useProjectStore((s) => s.commentsByTask.get(taskId)) ?? EMPTY_COMMENTS;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listComments(taskId);
      setComments(taskId, data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId, setComments]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    tasksApi
      .listComments(taskId)
      .then((data) => {
        if (cancelled) return;
        setComments(taskId, data);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error loading comments:", err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, setComments]);

  function emitTyping() {
    if (!socket) return;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("task:comment:typing", { taskId, projectId });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("task:comment:typing:stop", { taskId, projectId });
    }, 2500);
  }

  function handleContentChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    emitTyping();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.createComment(taskId, content.trim());
      setContent("");
      if (socket && isTypingRef.current) {
        isTypingRef.current = false;
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
      await fetchComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar comentario");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (socket && isTypingRef.current) {
        socket.emit("task:comment:typing:stop", { taskId, projectId });
      }
    };
  }, [socket, taskId, projectId]);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Comentarios</h3>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aún no hay comentarios.</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="flex gap-3">
              <UserAvatar
                userId={comment.authorId}
                name={`${comment.author.firstName} ${comment.author.lastName}`}
                className="size-8"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {comment.author.firstName} {comment.author.lastName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(comment.createdAt)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <TaskCommentTyping taskId={taskId} />
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={content}
          onChange={handleContentChange}
          placeholder="Escribe un comentario..."
          rows={3}
          maxLength={10000}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={submitting || !content.trim()}>
            {submitting ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
