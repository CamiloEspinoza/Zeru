"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { CalendarEvent } from "@/hooks/use-calendar-events";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  interviews: "Entrevista",
  accounting: "Contabilidad",
  automations: "Automatizacion",
};

const SOURCE_BADGE_STYLES: Record<string, string> = {
  linkedin: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  interviews: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  accounting: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  automations: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

interface EventDetailPanelProps {
  event: CalendarEvent;
  onClose: () => void;
}

export function EventDetailPanel({ event, onClose }: EventDetailPanelProps) {
  const meta = event.metadata;

  return (
    <div className="flex h-full w-[350px] shrink-0 flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Detalle
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 hover:bg-muted text-muted-foreground transition-colors"
          aria-label="Cerrar panel"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Badge className={SOURCE_BADGE_STYLES[event.source] ?? ""}>
            {SOURCE_LABELS[event.source] ?? event.source}
          </Badge>
          {event.status && (
            <Badge variant="outline" className="text-[10px]">
              {event.status}
            </Badge>
          )}
        </div>

        <h3 className="text-base font-semibold">{event.title}</h3>

        <p className="text-sm text-muted-foreground">
          {new Date(event.start).toLocaleString("es-CL", {
            dateStyle: "full",
            timeStyle: event.allDay ? undefined : "short",
          })}
        </p>

        {event.source === "linkedin" && Boolean(meta.content) && (
          <div className="rounded-md border p-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {String(meta.content).slice(0, 500)}
            </p>
          </div>
        )}

        {event.source === "interviews" && (
          <div className="space-y-2">
            {Boolean(meta.projectName) && (
              <p className="text-sm">
                <span className="text-muted-foreground">Proyecto:</span>{" "}
                {String(meta.projectName)}
              </p>
            )}
            {Array.isArray(meta.speakers) && meta.speakers.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Participantes:</p>
                <div className="flex flex-wrap gap-1">
                  {(meta.speakers as string[]).map((name, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {event.source === "accounting" && Boolean(meta.periodName) && (
          <p className="text-sm">
            <span className="text-muted-foreground">Periodo:</span>{" "}
            {String(meta.periodName)}
          </p>
        )}
      </div>

      <div className="border-t p-4">
        <Button asChild className="w-full">
          <Link href={event.href}>Abrir</Link>
        </Button>
      </div>
    </div>
  );
}
