"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConversationsSidebar } from "@/components/assistant/conversations-sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { HugeiconsIcon } from "@hugeicons/react";
import { AiChat02Icon } from "@hugeicons/core-free-icons";

export default function AssistantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isMobile) {
    return (
      // -m-6 undoes the dashboard's p-6, -mt-4 undoes the gap-4 from flex col
      <div className="-m-6 flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Mobile toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex items-center justify-center size-8 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Abrir conversaciones"
          >
            <HugeiconsIcon icon={AiChat02Icon} className="size-5" />
          </button>
          <span className="text-sm font-medium truncate">Asistente</span>
        </div>

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SheetTitle className="sr-only">Conversaciones</SheetTitle>
            <ConversationsSidebar onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    // -m-6 undoes the dashboard's p-6, -mt-4 undoes the gap-4 from flex col
    // This lets the assistant fill the full inset area edge-to-edge
    <div className="-m-6 flex min-h-0 flex-1 overflow-hidden">
      <ConversationsSidebar />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
