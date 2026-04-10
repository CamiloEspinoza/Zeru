"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: "linkedin" | "interviews" | "accounting" | "automations";
  status?: string;
  color: string;
  metadata: Record<string, unknown>;
  href: string;
}

interface UseCalendarEventsParams {
  from: Date;
  to: Date;
  sources: Set<string>;
}

export function useCalendarEvents({ from, to, sources }: UseCalendarEventsParams) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const sourcesKey = Array.from(sources).join(",");

  const fetchEvents = useCallback(async () => {
    if (sources.size === 0) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: fromIso,
        to: toIso,
        sources: sourcesKey,
      });
      const res = await api.get<{ data: CalendarEvent[] }>(
        `/calendar/events?${params.toString()}`,
      );
      setEvents(res.data);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, sourcesKey]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
