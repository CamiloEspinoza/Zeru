"use client";

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

export function PostPreviewCard({
  post,
  onApprove,
  onReject,
}: {
  post: PostData;
  onApprove?: (postId: string) => void;
  onReject?: (postId: string) => void;
}) {
  const statusInfo = STATUS_LABELS[post.status] ?? { label: post.status, color: "bg-muted text-muted-foreground" };
  const isApproved = post.status === "PUBLISHED";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* LinkedIn-style header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="h-10 w-10 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
          <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">Tu perfil de LinkedIn</span>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {post.contentPillar && (
              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                {post.contentPillar}
              </span>
            )}
          </div>
          {post.scheduledAt && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Programado para {new Date(post.scheduledAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}
        </div>
      </div>

      {/* Post content */}
      <div className="p-4">
        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{post.content}</p>

        {post.mediaUrl && post.mediaType === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.mediaUrl}
            alt="Post image"
            className="mt-3 rounded-lg w-full object-cover max-h-64"
          />
        )}

        {post.mediaUrl && post.mediaType === "ARTICLE" && (
          <a
            href={post.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors text-xs text-primary"
          >
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {post.mediaUrl}
          </a>
        )}
      </div>

      {/* Actions for pending approval */}
      {post.status === "PENDING_APPROVAL" && onApprove && onReject && (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => onApprove(post.id)}
            className="flex-1 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] transition-colors"
          >
            Publicar en LinkedIn
          </button>
          <button
            onClick={() => onReject(post.id)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {isApproved && (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-xs">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Publicado en LinkedIn
          </div>
        </div>
      )}
    </div>
  );
}
