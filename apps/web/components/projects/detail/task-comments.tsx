"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { RichEditor } from "@/components/ui/rich-editor";
import { useSocket } from "@/hooks/use-socket";
import { useProjectStore } from "@/stores/project-store";
import type { TaskComment } from "@/types/projects";

const EMPTY_COMMENTS: TaskComment[] = [];
import { tasksApi } from "@/lib/api/tasks";
import { uploadsApi } from "@/lib/api/uploads";
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

/** Check if HTML content is effectively empty */
function isEmptyHtml(html: string): boolean {
  const stripped = html
    .replace(/<p><\/p>/g, "")
    .replace(/<br\s*\/?>/g, "")
    .replace(/\s+/g, "")
    .trim();
  return stripped.length === 0;
}

/**
 * Ensure content is valid HTML for the rich editor.
 * Old comments stored as plain text need to be wrapped in <p> tags.
 */
function ensureHtml(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  // If it already starts with an HTML tag, treat it as HTML
  if (trimmed.startsWith("<")) return trimmed;
  // Otherwise, wrap plain text lines in <p> tags
  return trimmed
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
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

  function handleContentChange(html: string) {
    setContent(html);
    emitTyping();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isEmptyHtml(content)) return;
    setSubmitting(true);
    try {
      await tasksApi.createComment(taskId, content);
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

  const handleImageUpload = useCallback(async (file: File): Promise<string> => {
    const result = await uploadsApi.uploadImage(file);
    return result.url;
  }, []);

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
                name={`${comment.author.firstName} ${comment.author.lastName}`}
                avatarUrl={comment.author.avatarUrl}
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
                <div className="mt-0.5">
                  <RichEditor
                    content={ensureHtml(comment.content)}
                    editable={false}
                    className="border-none p-0"
                    minHeight="auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <TaskCommentTyping taskId={taskId} />
      <form onSubmit={handleSubmit} className="space-y-2">
        <RichEditor
          content={content}
          onChange={handleContentChange}
          placeholder="Escribe un comentario..."
          onImageUpload={handleImageUpload}
          minHeight="60px"
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={submitting || isEmptyHtml(content)}>
            {submitting ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
