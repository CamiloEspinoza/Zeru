"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskComment } from "@/types/projects";

interface TaskCommentsProps {
  taskId: string;
}

function initials(firstName: string, lastName: string): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
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

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tasksApi.listComments(taskId);
      setComments(data);
    } catch (err) {
      console.error("Error loading comments:", err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await tasksApi.createComment(taskId, content.trim());
      setContent("");
      await fetchComments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al publicar comentario");
    } finally {
      setSubmitting(false);
    }
  }

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
              <Avatar className="size-8">
                <AvatarFallback className="text-xs">
                  {initials(comment.author.firstName, comment.author.lastName)}
                </AvatarFallback>
              </Avatar>
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
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
