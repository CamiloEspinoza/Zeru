"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface LinkedInConversation {
  id: string;
  title: string;
  updatedAt: string;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function LinkedInSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<LinkedInConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(() => {
    api
      .get<LinkedInConversation[]>("/linkedin/conversations")
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, pathname]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.delete(`/linkedin/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/linkedin/${id}`) {
        router.push("/linkedin/new");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const activeId = pathname.startsWith("/linkedin/")
    ? pathname.split("/linkedin/")[1]
    : null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Conversaciones
        </span>
        <Link
          href="/linkedin/new"
          className="flex items-center justify-center size-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Nueva conversación"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <Link
          href="/linkedin/posts"
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
            pathname === "/linkedin/posts"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendario de Posts
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-4 animate-spin rounded-full border-2 border-[#0A66C2] border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
            <div className="size-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
              <svg className="size-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </div>
            <p className="text-xs text-muted-foreground">Sin conversaciones</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <Link
                key={conv.id}
                href={`/linkedin/${conv.id}`}
                className={cn(
                  "group relative flex items-start gap-2 px-3 py-2.5 mx-1 rounded-lg transition-colors",
                  isActive
                    ? "bg-[#0A66C2]/10 text-foreground border-l-2 border-l-[#0A66C2]/50"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground">
                    {conv.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {relativeTime(conv.updatedAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(conv.id, e)}
                  disabled={deletingId === conv.id}
                  className={cn(
                    "shrink-0 mt-0.5 flex items-center justify-center size-5 rounded transition-all text-muted-foreground hover:text-destructive",
                    "opacity-0 group-hover:opacity-100",
                    deletingId === conv.id && "opacity-100"
                  )}
                  title="Eliminar"
                >
                  {deletingId === conv.id ? (
                    <div className="size-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                  ) : (
                    <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </Link>
            );
          })
        )}
      </div>
    </aside>
  );
}
