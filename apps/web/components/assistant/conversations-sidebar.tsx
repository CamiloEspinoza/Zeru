"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  AiChat02Icon,
} from "@hugeicons/core-free-icons";

interface ConversationSummary {
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

export function ConversationsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchConversations = useCallback(() => {
    api
      .get<ConversationSummary[]>("/ai/conversations")
      .then(setConversations)
      .catch(() => setConversations([]))
      .finally(() => setLoading(false));
  }, []);

  // Refetch whenever the route changes (e.g. new conversation created)
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations, pathname]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.delete(`/ai/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      // If we deleted the active conversation, go to new
      if (pathname === `/assistant/${id}`) {
        router.push("/assistant/new");
      }
    } finally {
      setDeletingId(null);
    }
  }

  const activeId = pathname.startsWith("/assistant/")
    ? pathname.split("/assistant/")[1]
    : null;

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Conversaciones
        </span>
        <Link
          href="/assistant/new"
          className="flex items-center justify-center size-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Nueva conversación"
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
        </Link>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
            <HugeiconsIcon icon={AiChat02Icon} className="size-8 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">Sin conversaciones</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = activeId === conv.id;
            return (
              <Link
                key={conv.id}
                href={`/assistant/${conv.id}`}
                className={cn(
                  "group relative flex items-start gap-2 px-3 py-2.5 mx-1 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground border-l-2 border-l-primary/40"
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
                    <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
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
