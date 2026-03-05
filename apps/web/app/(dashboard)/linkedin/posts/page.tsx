"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LinkedInPost {
  id: string;
  content: string;
  mediaType: string;
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  contentPillar: string | null;
  visibility: string;
  errorMessage: string | null;
  createdAt: string;
}

interface PostsResult {
  posts: LinkedInPost[];
  total: number;
  page: number;
  perPage: number;
}

const STATUS_CONFIG: Record<string, { label: string; classes: string }> = {
  DRAFT: { label: "Borrador", classes: "bg-muted text-muted-foreground" },
  PENDING_APPROVAL: { label: "Por aprobar", classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  SCHEDULED: { label: "Programado", classes: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  PUBLISHED: { label: "Publicado", classes: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  FAILED: { label: "Fallido", classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  CANCELLED: { label: "Cancelado", classes: "bg-muted text-muted-foreground" },
};

const PILLAR_COLORS: Record<string, string> = {
  "thought-leadership": "border-l-purple-500",
  "tips": "border-l-blue-500",
  "case-study": "border-l-green-500",
  "industry-news": "border-l-orange-500",
  "behind-the-scenes": "border-l-pink-500",
};

export default function LinkedInPostsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    params.set("page", String(page));
    params.set("perPage", "20");

    api
      .get<PostsResult>(`/linkedin/posts?${params.toString()}`)
      .then((result) => {
        setPosts(result.posts);
        setTotal(result.total);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [statusFilter, page]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePublish = async (postId: string) => {
    setActionLoading(postId);
    try {
      await api.post(`/linkedin/posts/${postId}/publish`, {});
      fetchPosts();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (postId: string) => {
    setActionLoading(postId);
    try {
      await api.post(`/linkedin/posts/${postId}/cancel`, {});
      fetchPosts();
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      <div className="px-6 py-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold">Posts de LinkedIn</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{total} posts en total</p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-sm rounded-lg border border-border bg-background px-3 py-1.5 outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="size-6 animate-spin rounded-full border-2 border-[#0A66C2] border-t-transparent" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
            <div className="size-12 rounded-full bg-muted flex items-center justify-center">
              <svg className="size-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-foreground">Sin posts</p>
              <p className="text-sm text-muted-foreground">Usa el agente para crear y programar posts.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => {
              const statusInfo = STATUS_CONFIG[post.status] ?? { label: post.status, classes: "bg-muted text-muted-foreground" };
              const pillarColor = post.contentPillar ? PILLAR_COLORS[post.contentPillar] ?? "border-l-muted" : "border-l-muted";
              return (
                <div
                  key={post.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4 border-l-4",
                    pillarColor
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusInfo.classes)}>
                          {statusInfo.label}
                        </span>
                        {post.contentPillar && (
                          <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {post.contentPillar}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">{post.visibility}</span>
                      </div>

                      <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap leading-relaxed">
                        {post.content}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {post.scheduledAt && (
                          <span>
                            <span className="text-muted-foreground/70">Programado: </span>
                            {new Date(post.scheduledAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        )}
                        {post.publishedAt && (
                          <span>
                            <span className="text-muted-foreground/70">Publicado: </span>
                            {new Date(post.publishedAt).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        )}
                        {!post.scheduledAt && !post.publishedAt && (
                          <span>Creado {new Date(post.createdAt).toLocaleDateString("es-CL")}</span>
                        )}
                      </div>

                      {post.errorMessage && (
                        <p className="text-xs text-destructive mt-1">Error: {post.errorMessage}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {["PENDING_APPROVAL", "SCHEDULED"].includes(post.status) && (
                        <button
                          onClick={() => handlePublish(post.id)}
                          disabled={actionLoading === post.id}
                          className="rounded-lg bg-[#0A66C2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#004182] transition-colors disabled:opacity-50"
                        >
                          {actionLoading === post.id ? "..." : "Publicar"}
                        </button>
                      )}
                      {["PENDING_APPROVAL", "SCHEDULED", "DRAFT"].includes(post.status) && (
                        <button
                          onClick={() => handleCancel(post.id)}
                          disabled={actionLoading === post.id}
                          className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Anterior
            </button>
            <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50 hover:bg-muted transition-colors"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
