"use client";

import { useState } from "react";

interface PostData {
  id: string;
  content: string;
  mediaType: string;
  mediaUrl?: string | null;
  imageS3Key?: string | null;
  status: string;
  scheduledAt?: string | null;
  contentPillar?: string | null;
  visibility: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "bg-muted text-muted-foreground" },
  PENDING_APPROVAL: { label: "Pendiente de aprobación", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  SCHEDULED: { label: "Programado", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  PUBLISHED: { label: "Publicado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  FAILED: { label: "Fallido", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  CANCELLED: { label: "Cancelado", color: "bg-muted text-muted-foreground line-through" },
};

function toLocalDatetimeValue(date?: Date): string {
  const d = date ?? new Date(Date.now() + 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PostPreviewCard({
  post,
  onApprove,
  onReject,
  onSchedule,
}: {
  post: PostData;
  onApprove?: (postId: string) => Promise<void>;
  onReject?: (postId: string) => Promise<void>;
  onSchedule?: (postId: string, scheduledAt: Date) => Promise<void>;
}) {
  const statusInfo = STATUS_LABELS[post.status] ?? { label: post.status, color: "bg-muted text-muted-foreground" };
  const isApproved = post.status === "PUBLISHED";

  const [isPublishing, setIsPublishing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(toLocalDatetimeValue());
  const [isScheduling, setIsScheduling] = useState(false);

  const handleApprove = async () => {
    if (!onApprove || isPublishing) return;
    setIsPublishing(true);
    try {
      await onApprove(post.id);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleReject = async () => {
    if (!onReject || isCancelling) return;
    setIsCancelling(true);
    try {
      await onReject(post.id);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleScheduleConfirm = async () => {
    if (!onSchedule || isScheduling) return;
    setIsScheduling(true);
    try {
      await onSchedule(post.id, new Date(scheduleValue));
      setShowScheduler(false);
    } finally {
      setIsScheduling(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <div className="h-11 w-11 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0 shadow-sm">
          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold leading-tight">Tu perfil de LinkedIn</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {post.contentPillar && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {post.contentPillar}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {post.scheduledAt
              ? `Programado · ${new Date(post.scheduledAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}`
              : "Ahora · 🌐"}
          </p>
        </div>
      </div>

      {/* Post content */}
      <div className="px-4 pb-3">
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{post.content}</p>
      </div>

      {/* Image */}
      {post.mediaUrl && post.mediaType === "IMAGE" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.mediaUrl}
          alt="Post image"
          className="w-full object-contain max-h-[420px] bg-muted/20"
        />
      )}

      {/* Article link */}
      {post.mediaUrl && post.mediaType === "ARTICLE" && (
        <div className="mx-4 mb-3">
          <a
            href={post.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors text-xs text-primary"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="truncate">{post.mediaUrl}</span>
          </a>
        </div>
      )}

      {/* Divider */}
      <div className="mx-4 border-t border-border/50 mt-1" />

      {/* Actions for pending approval */}
      {post.status === "PENDING_APPROVAL" && (onApprove || onReject || onSchedule) && (
        <div className="px-4 py-3 space-y-2.5">
          <div className="flex gap-2">
            {onApprove && (
              <button
                onClick={handleApprove}
                disabled={isPublishing || isCancelling || isScheduling}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004182] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPublishing ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Publicando…
                  </>
                ) : (
                  "Publicar en LinkedIn"
                )}
              </button>
            )}
            {onSchedule && !showScheduler && (
              <button
                onClick={() => setShowScheduler(true)}
                disabled={isPublishing || isCancelling}
                className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Programar
              </button>
            )}
            {onReject && (
              <button
                onClick={handleReject}
                disabled={isPublishing || isCancelling || isScheduling}
                className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isCancelling ? "…" : "Descartar"}
              </button>
            )}
          </div>

          {/* Inline date picker */}
          {showScheduler && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <input
                type="datetime-local"
                value={scheduleValue}
                onChange={(e) => setScheduleValue(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                min={toLocalDatetimeValue()}
              />
              <button
                onClick={handleScheduleConfirm}
                disabled={isScheduling || !scheduleValue}
                className="flex items-center gap-1.5 rounded-md bg-[#0A66C2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#004182] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
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
                className="text-muted-foreground hover:text-foreground transition-colors text-base leading-none px-1"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}

      {/* Published state */}
      {isApproved && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs font-medium">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Publicado exitosamente en LinkedIn
          </div>
        </div>
      )}

      {/* Scheduled state */}
      {post.status === "SCHEDULED" && (
        <div className="px-4 py-3">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-medium">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {post.scheduledAt
              ? `Publicación programada para el ${new Date(post.scheduledAt).toLocaleString("es-CL", { dateStyle: "long", timeStyle: "short" })}`
              : "Publicación programada"}
          </div>
        </div>
      )}
    </div>
  );
}
