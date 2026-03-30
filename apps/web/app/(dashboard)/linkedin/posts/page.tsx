"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

const BULK_ELIGIBLE = ["PENDING_APPROVAL", "SCHEDULED", "DRAFT"];

export default function LinkedInPostsPage() {
  const [posts, setPosts] = useState<LinkedInPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Selection state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"publish" | "cancel" | null>(null);

  // Publish confirmation dialog state
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [postToPublish, setPostToPublish] = useState<LinkedInPost | null>(null);
  const [bulkPublishConfirmOpen, setBulkPublishConfirmOpen] = useState(false);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    setSelected(new Set());
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
    setPublishConfirmOpen(false);
    setPostToPublish(null);
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

  // Bulk actions
  const selectablePosts = posts.filter((p) => BULK_ELIGIBLE.includes(p.status));
  const allSelected = selectablePosts.length > 0 && selectablePosts.every((p) => selected.has(p.id));
  const someSelected = selected.size > 0;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectablePosts.map((p) => p.id)));
    }
  };

  const handleBulkPublish = async () => {
    if (bulkAction || selected.size === 0) return;
    setBulkPublishConfirmOpen(false);
    setBulkAction("publish");
    try {
      await Promise.allSettled([...selected].map((id) => api.post(`/linkedin/posts/${id}/publish`, {})));
      fetchPosts();
    } finally {
      setBulkAction(null);
    }
  };

  const handleBulkCancel = async () => {
    if (bulkAction || selected.size === 0) return;
    setBulkAction("cancel");
    try {
      await Promise.allSettled([...selected].map((id) => api.post(`/linkedin/posts/${id}/cancel`, {})));
      fetchPosts();
    } finally {
      setBulkAction(null);
    }
  };

  const openPublishConfirmation = (post: LinkedInPost) => {
    setPostToPublish(post);
    setPublishConfirmOpen(true);
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

        {/* Bulk action bar */}
        {someSelected && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#0A66C2]/30 bg-[#0A66C2]/5 px-4 py-3">
            <span className="text-sm font-medium text-foreground">
              {selected.size} post{selected.size !== 1 ? "s" : ""} seleccionado{selected.size !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setBulkPublishConfirmOpen(true)}
                disabled={!!bulkAction}
                className="flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#004182] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkAction === "publish" ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Publicando…
                  </>
                ) : (
                  "Publicar seleccionados"
                )}
              </button>
              <button
                onClick={handleBulkCancel}
                disabled={!!bulkAction}
                className="rounded-lg border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {bulkAction === "cancel" ? "Cancelando…" : "Cancelar seleccionados"}
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                ×
              </button>
            </div>
          </div>
        )}

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
            {/* Select all row */}
            {selectablePosts.length > 1 && (
              <div className="flex items-center gap-2 px-1 pb-1">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-border accent-[#0A66C2] cursor-pointer"
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-xs text-muted-foreground cursor-pointer select-none">
                  Seleccionar todos los posts accionables ({selectablePosts.length})
                </label>
              </div>
            )}

            {posts.map((post) => {
              const statusInfo = STATUS_CONFIG[post.status] ?? { label: post.status, classes: "bg-muted text-muted-foreground" };
              const pillarColor = post.contentPillar ? PILLAR_COLORS[post.contentPillar] ?? "border-l-muted" : "border-l-muted";
              const isSelectable = BULK_ELIGIBLE.includes(post.status);
              const isSelected = selected.has(post.id);

              return (
                <div
                  key={post.id}
                  className={cn(
                    "rounded-xl border border-border bg-card p-4 border-l-4 transition-colors",
                    pillarColor,
                    isSelected && "ring-2 ring-[#0A66C2]/40 border-[#0A66C2]/30"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    {isSelectable && (
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(post.id)}
                          className="h-4 w-4 rounded border-border accent-[#0A66C2] cursor-pointer"
                        />
                      </div>
                    )}
                    {!isSelectable && <div className="w-4" />}

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
                          onClick={() => openPublishConfirmation(post)}
                          disabled={actionLoading === post.id}
                          className="rounded-lg bg-[#0A66C2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#004182] transition-colors disabled:opacity-50"
                        >
                          {actionLoading === post.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : "Publicar"}
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

      {/* Dialog: Confirmar publicación individual */}
      <Dialog open={publishConfirmOpen} onOpenChange={setPublishConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Publicar este post en LinkedIn?</DialogTitle>
            <DialogDescription>
              El post se publicará inmediatamente en tu perfil de LinkedIn. Esta
              acción no se puede deshacer fácilmente.
            </DialogDescription>
          </DialogHeader>
          {postToPublish && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-xs text-foreground line-clamp-4 whitespace-pre-wrap leading-relaxed">
                {postToPublish.content}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPublishConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => postToPublish && handlePublish(postToPublish.id)}
              disabled={!!actionLoading}
            >
              {actionLoading ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar publicación masiva */}
      <Dialog open={bulkPublishConfirmOpen} onOpenChange={setBulkPublishConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Publicar {selected.size} post{selected.size !== 1 ? "s" : ""} en LinkedIn?</DialogTitle>
            <DialogDescription>
              Los posts seleccionados se publicarán inmediatamente en tu perfil de
              LinkedIn. Esta acción no se puede deshacer fácilmente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkPublishConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleBulkPublish}
              disabled={!!bulkAction}
            >
              {bulkAction === "publish" ? "Publicando..." : "Publicar todos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
