"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ConversationListSidebar } from "@/components/shared/conversation-list-sidebar";

interface LinkedInConversation {
  id: string;
  title: string;
  updatedAt: string;
}

export function LinkedInSidebar() {
  const pathname = usePathname();

  return (
    <ConversationListSidebar
      endpoint="/linkedin/conversations"
      routePrefix="linkedin"
      emptyMessage="Sin conversaciones"
      renderTitle={(item) => (item as LinkedInConversation).title}
      newHref="/assistant/new"
      extraHeader={
        <div className="px-3 py-2 border-b border-border">
          <Link
            href="/linkedin/posts"
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
              pathname === "/linkedin/posts"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <svg className="size-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendario de Posts
          </Link>
        </div>
      }
      emptyIcon={
        <div className="size-8 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
          <svg className="size-4 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </div>
      }
    />
  );
}
