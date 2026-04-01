"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format-time";

interface SidebarItem {
  id: string;
  updatedAt: string;
}

export interface ConversationListSidebarHandle {
  updateItems: (updater: (prev: SidebarItem[]) => SidebarItem[]) => void;
}

interface ConversationListSidebarProps {
  endpoint: string;
  routePrefix: string;
  emptyMessage: string;
  renderTitle: (item: SidebarItem) => string;
  renderSubtitle?: (item: SidebarItem) => React.ReactNode | null;
  onNavigate?: () => void;
  newHref?: string;
  extraHeader?: React.ReactNode;
  emptyIcon?: React.ReactNode;
}

function ConversationListSidebarInner(
  {
    endpoint,
    routePrefix,
    emptyMessage,
    renderTitle,
    renderSubtitle,
    onNavigate,
    newHref = "/assistant/new",
    extraHeader,
    emptyIcon,
  }: ConversationListSidebarProps,
  ref: React.Ref<ConversationListSidebarHandle>,
) {
  const pathname = usePathname();
  const router = useRouter();
  const [items, setItems] = useState<SidebarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({ updateItems: (fn) => setItems(fn) }));

  const fetchItems = useCallback(() => {
    api
      .get<SidebarItem[]>(endpoint)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [endpoint]);

  useEffect(() => { fetchItems(); }, [fetchItems, pathname]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (pathname === `/${routePrefix}/${id}`) router.push(newHref);
    } finally {
      setDeletingId(null);
    }
  }

  const activeId = pathname.startsWith(`/${routePrefix}/`)
    ? pathname.split(`/${routePrefix}/`)[1]
    : null;

  return (
    <aside className="flex w-full md:w-60 shrink-0 flex-col border-r border-border bg-background overflow-hidden">
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Conversaciones
        </span>
        <Link
          href={newHref}
          onClick={onNavigate}
          className="flex items-center justify-center size-6 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Nueva conversación"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
      </div>

      {extraHeader}

      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center">
            {emptyIcon}
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          items.map((item) => {
            const isActive = activeId === item.id;
            return (
              <Link
                key={item.id}
                href={`/${routePrefix}/${item.id}`}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-start gap-2 px-3 py-2.5 mx-1 rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/10 text-foreground border-l-2 border-l-primary/40"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-snug line-clamp-2 text-foreground">
                    {renderTitle(item)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {relativeTime(item.updatedAt)}
                  </p>
                  {renderSubtitle?.(item)}
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDelete(item.id, e)}
                  disabled={deletingId === item.id}
                  className={cn(
                    "shrink-0 mt-0.5 flex items-center justify-center size-5 rounded transition-all text-muted-foreground hover:text-destructive",
                    "opacity-0 group-hover:opacity-100",
                    deletingId === item.id && "opacity-100",
                  )}
                  title="Eliminar"
                >
                  {deletingId === item.id ? (
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

export const ConversationListSidebar = forwardRef(ConversationListSidebarInner);
