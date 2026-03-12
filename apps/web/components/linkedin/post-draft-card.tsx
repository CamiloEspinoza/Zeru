"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";
import { ImagePromptCard } from "./image-prompt-card";
import { VersionHistoryPopover } from "./version-history-popover";

export interface PostDraftData {
  id: string;
  content: string;
  mediaType: string;
  mediaUrl?: string | null;
  imageS3Key?: string | null;
  imagePrompt?: string | null;
  status: string;
  scheduledAt?: string | null;
  contentPillar?: string | null;
  visibility: string;
}

interface PostVersion {
  id: string;
  content: string;
  versionNumber: number;
  instructions?: string | null;
  createdAt: string;
}

interface ImageVersion {
  id: string;
  prompt: string;
  imageUrl: string;
  versionNumber: number;
  isSelected: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  PENDING_APPROVAL: { label: "Pendiente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  SCHEDULED: { label: "Programado", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  PUBLISHED: { label: "Publicado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  FAILED: { label: "Fallido", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  CANCELLED: { label: "Cancelado", color: "bg-muted text-muted-foreground line-through" },
};

function toLocalDatetimeValue(date?: Date | string): string {
  const d = date ? new Date(date) : new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostDraftCard({
  post: initialPost,
  onStatusChange,
}: {
  post: PostDraftData;
  onStatusChange?: (postId: string, newStatus: string) => void;
}) {
  const [post, setPost] = useState(initialPost);
  const [expanded, setExpanded] = useState(false);

  // Refetch current post status on mount — tool results from history are snapshots; status may have changed (e.g. approved/scheduled)
  useEffect(() => {
    api
      .get<PostDraftData>(`/linkedin/posts/${initialPost.id}`)
      .then(setPost)
      .catch(() => {});
  }, [initialPost.id]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [versions, setVersions] = useState<PostVersion[]>([]);
  const [imageVersions, setImageVersions] = useState<ImageVersion[]>([]);
  const [versionsLoaded, setVersionsLoaded] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(
    toLocalDatetimeValue(post.scheduledAt ?? undefined),
  );
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const statusInfo = STATUS_LABELS[post.status] ?? { label: post.status, color: "bg-muted text-muted-foreground" };
  const isEditable = ["DRAFT", "PENDING_APPROVAL"].includes(post.status);
  const needsTruncation = post.content.length > 280;
  const displayContent = needsTruncation && !expanded
    ? post.content.slice(0, 280) + "…"
    : post.content;

  const loadVersions = useCallback(async () => {
    if (versionsLoaded) return;
    try {
      const [textVersions, imgVersions] = await Promise.all([
        api.get<PostVersion[]>(`/linkedin/posts/${post.id}/versions`),
        api.get<ImageVersion[]>(`/linkedin/posts/${post.id}/image-versions`),
      ]);
      setVersions(textVersions);
      setImageVersions(imgVersions);
      setVersionsLoaded(true);
    } catch {
      // silently fail
    }
  }, [post.id, versionsLoaded]);

  const handleRegenerate = async () => {
    if (!regenInstructions.trim() || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await api.post(`/linkedin/posts/${post.id}/regenerate`, {
        instructions: regenInstructions.trim(),
      });
      // Fetch updated post
      const updated = await api.get<PostDraftData>(`/linkedin/posts/${post.id}`);
      setPost(updated);
      setShowRegenInput(false);
      setRegenInstructions("");
      // Reload versions
      setVersionsLoaded(false);
    } catch {
      // silently fail
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSelectVersion = async (versionId: string) => {
    try {
      const updated = await api.put<PostDraftData>(`/linkedin/posts/${post.id}/select-version`, { versionId });
      setPost((prev) => ({ ...prev, content: updated.content }));
      setVersionsLoaded(false);
    } catch {
      // silently fail
    }
  };

  const handleApproveAndSchedule = async () => {
    if (isScheduling) return;
    setIsScheduling(true);
    try {
      await api.post(`/linkedin/posts/${post.id}/reschedule`, {
        scheduledAt: new Date(scheduleValue).toISOString(),
      });
      setPost((prev) => ({ ...prev, status: "SCHEDULED", scheduledAt: new Date(scheduleValue).toISOString() }));
      setShowScheduler(false);
      onStatusChange?.(post.id, "SCHEDULED");
    } catch {
      // silently fail
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancel = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    try {
      await api.post(`/linkedin/posts/${post.id}/cancel`, {});
      setPost((prev) => ({ ...prev, status: "CANCELLED" }));
      onStatusChange?.(post.id, "CANCELLED");
    } catch {
      // silently fail
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    setScheduleValue(newDate);
    if (post.status === "SCHEDULED") {
      try {
        await api.post(`/linkedin/posts/${post.id}/reschedule`, {
          scheduledAt: new Date(newDate).toISOString(),
        });
        setPost((prev) => ({ ...prev, scheduledAt: new Date(newDate).toISOString() }));
      } catch {
        // silently fail
      }
    }
  };

  const handleImageUpdated = (imageUrl: string) => {
    setPost((prev) => ({ ...prev, mediaType: "IMAGE", mediaUrl: imageUrl }));
    setVersionsLoaded(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden flex flex-col h-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <div className="h-8 w-8 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
          <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {post.contentPillar && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {post.contentPillar}
              </span>
            )}
          </div>
        </div>
        {/* Regenerate button (magic wand) */}
        {isEditable && (
          <button
            onClick={() => {
              setShowRegenInput(!showRegenInput);
              loadVersions();
            }}
            disabled={isRegenerating}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Regenerar contenido con IA"
          >
            {isRegenerating ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Regen instructions input */}
      {showRegenInput && isEditable && (
        <div className="mx-3 mb-2 rounded-lg border border-border bg-muted/20 p-2 space-y-1.5">
          <textarea
            value={regenInstructions}
            onChange={(e) => setRegenInstructions(e.target.value)}
            placeholder="Ej: Hazlo más corto, usa un tono más provocador, agrega estadísticas..."
            rows={2}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleRegenerate}
              disabled={!regenInstructions.trim() || isRegenerating}
              className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isRegenerating ? "Regenerando…" : "Regenerar"}
            </button>
            <button
              onClick={() => setShowRegenInput(false)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
            <div className="flex-1" />
            <VersionHistoryPopover
              versions={versions}
              onSelect={handleSelectVersion}
            />
          </div>
        </div>
      )}

      {/* Post content */}
      <div className="px-3 pb-2 flex-1">
        <p className="text-xs whitespace-pre-wrap leading-relaxed text-foreground">
          {displayContent}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-primary font-medium hover:underline mt-0.5"
          >
            {expanded ? "ver menos" : "...ver más"}
          </button>
        )}
      </div>

      {/* Image section */}
      <div className="px-3 pb-2">
        <ImagePromptCard
          postId={post.id}
          initialPrompt={post.imagePrompt}
          currentImageUrl={post.mediaUrl}
          imageVersions={imageVersions}
          onImageUpdated={handleImageUpdated}
        />
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-border/50" />

      {/* Date/time picker */}
      {isEditable && (
        <div className="flex items-center gap-2 px-3 py-2">
          <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => handleDateChange(e.target.value)}
            className="flex-1 bg-transparent text-xs outline-none text-foreground min-w-0"
            min={toLocalDatetimeValue()}
          />
        </div>
      )}

      {/* Action buttons */}
      {isEditable && (
        <div className="flex gap-2 px-3 pb-3">
          {!showScheduler ? (
            <>
              <button
                onClick={() => setShowScheduler(true)}
                disabled={isScheduling || isCancelling}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004182] transition-colors disabled:opacity-50"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Aprobar y programar
              </button>
              <button
                onClick={handleCancel}
                disabled={isScheduling || isCancelling}
                className="rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-50"
              >
                {isCancelling ? "…" : "Descartar"}
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleApproveAndSchedule}
                disabled={isScheduling || !scheduleValue}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-2 text-xs font-semibold text-white hover:bg-[#004182] transition-colors disabled:opacity-50"
              >
                {isScheduling ? (
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                ) : (
                  "Confirmar"
                )}
              </button>
              <button
                onClick={() => setShowScheduler(false)}
                className="text-muted-foreground hover:text-foreground text-base leading-none px-1"
              >
                &times;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scheduled state */}
      {post.status === "SCHEDULED" && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-[11px] font-medium">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Programado para {new Date(post.scheduledAt!).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
      )}

      {/* Published state */}
      {post.status === "PUBLISHED" && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-[11px] font-medium">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Publicado en LinkedIn
          </div>
        </div>
      )}
    </div>
  );
}
