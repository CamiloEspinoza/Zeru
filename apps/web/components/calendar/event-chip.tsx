"use client";

import type { CalendarEvent } from "@/hooks/use-calendar-events";

const SOURCE_BG: Record<string, string> = {
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  interviews: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  accounting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  automations: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

interface EventChipProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  compact?: boolean;
}

export function EventChip({ event, onClick, compact = false }: EventChipProps) {
  const colors = SOURCE_BG[event.source] ?? SOURCE_BG.linkedin;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      className={`w-full rounded px-1.5 text-left text-[10px] font-medium truncate transition-opacity hover:opacity-80 ${colors} ${
        compact ? "py-0" : "py-0.5"
      }`}
      title={event.title}
    >
      {event.title}
    </button>
  );
}
