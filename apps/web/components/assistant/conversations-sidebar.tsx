"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiChat02Icon } from "@hugeicons/core-free-icons";
import {
  ConversationListSidebar,
  type ConversationListSidebarHandle,
} from "@/components/shared/conversation-list-sidebar";

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
  stats?: {
    postedEntries: number;
    memoryActions: number;
    pendingDrafts: number;
  };
}

function ConversationBadges({ stats }: { stats?: ConversationSummary["stats"] }) {
  if (!stats || (stats.postedEntries === 0 && stats.memoryActions === 0 && stats.pendingDrafts === 0)) return null;
  return (
    <p className="text-[10px] text-muted-foreground mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5" title="Asientos contabilizados · Acciones en memoria · Asientos por confirmar">
      {stats.postedEntries > 0 && <span className="text-green-600 dark:text-green-400" title="Asientos contabilizados">✓ {stats.postedEntries}</span>}
      {stats.memoryActions > 0 && <span title="Guardó/buscó/eliminó en memoria">🧠 {stats.memoryActions}</span>}
      {stats.pendingDrafts > 0 && <span className="text-amber-600 dark:text-amber-400" title="Asientos en borrador por confirmar">○ {stats.pendingDrafts}</span>}
    </p>
  );
}

interface ConversationsSidebarProps {
  onNavigate?: () => void;
}

export function ConversationsSidebar({ onNavigate }: ConversationsSidebarProps) {
  const sidebarRef = useRef<ConversationListSidebarHandle>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const { conversationId: cid, toolName } = (e as CustomEvent).detail ?? {};
      if (!cid) return;
      sidebarRef.current?.updateItems((prev) =>
        prev.map((item) => {
          if (item.id !== cid) return item;
          const c = item as ConversationSummary;
          const stats = c.stats ?? { postedEntries: 0, memoryActions: 0, pendingDrafts: 0 };
          if (toolName === "create_journal_entry") {
            return { ...c, updatedAt: new Date().toISOString(), stats: { ...stats, pendingDrafts: stats.pendingDrafts + 1 } };
          }
          if (toolName === "post_journal_entry") {
            return { ...c, updatedAt: new Date().toISOString(), stats: { ...stats, postedEntries: stats.postedEntries + 1, pendingDrafts: Math.max(0, stats.pendingDrafts - 1) } };
          }
          return c;
        }),
      );
    };
    window.addEventListener("conversation-stats-delta", handler);
    return () => window.removeEventListener("conversation-stats-delta", handler);
  }, []);

  return (
    <ConversationListSidebar
      ref={sidebarRef}
      endpoint="/ai/conversations"
      routePrefix="assistant"
      emptyMessage="Sin conversaciones"
      renderTitle={(item) => (item as ConversationSummary).title}
      renderSubtitle={(item) => <ConversationBadges stats={(item as ConversationSummary).stats} />}
      onNavigate={onNavigate}
      newHref="/assistant/new"
      emptyIcon={<HugeiconsIcon icon={AiChat02Icon} className="size-8 text-muted-foreground/40" />}
    />
  );
}
