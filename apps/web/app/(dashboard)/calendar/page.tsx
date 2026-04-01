"use client";

import { useState, useCallback, useEffect } from "react";
import { useCalendarEvents, type CalendarEvent } from "@/hooks/use-calendar-events";
import { CalendarSidebar } from "@/components/calendar/calendar-sidebar";
import { CalendarHeader } from "@/components/calendar/calendar-header";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { EventDetailPanel } from "@/components/calendar/event-detail-panel";

function getMonthRange(date: Date): { from: Date; to: Date } {
  return {
    from: new Date(date.getFullYear(), date.getMonth(), 1),
    to: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59),
  };
}

function getWeekRange(date: Date): { from: Date; to: Date } {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59);
  return { from: monday, to: sunday };
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [enabledSources, setEnabledSources] = useState<Set<string>>(
    new Set(["linkedin", "interviews", "accounting"]),
  );
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const range = view === "month" ? getMonthRange(currentDate) : getWeekRange(currentDate);
  const { events, loading } = useCalendarEvents({
    from: range.from,
    to: range.to,
    sources: enabledSources,
  });

  const toggleSource = useCallback((source: string) => {
    setEnabledSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }, []);

  const prevPeriod = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(next.getMonth() - 1);
      else next.setDate(next.getDate() - 7);
      return next;
    });
  }, [view]);

  const nextPeriod = useCallback(() => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (view === "month") next.setMonth(next.getMonth() + 1);
      else next.setDate(next.getDate() + 7);
      return next;
    });
  }, [view]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);

  const handleDayClick = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      setView("week");
    },
    [],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "m" || e.key === "M") setView("month");
      else if (e.key === "w" || e.key === "W") setView("week");
      else if (e.key === "t" || e.key === "T") goToToday();
      else if (e.key === "Escape") setSelectedEvent(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goToToday]);

  return (
    <div className="flex h-full">
      <CalendarSidebar
        currentDate={currentDate}
        onDateSelect={(d) => setCurrentDate(d)}
        enabledSources={enabledSources}
        onToggleSource={toggleSource}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onViewChange={setView}
          onPrev={prevPeriod}
          onNext={nextPeriod}
          onToday={goToToday}
          loading={loading}
        />

        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0">
            {view === "month" ? (
              <MonthView
                currentDate={currentDate}
                events={events}
                onEventClick={setSelectedEvent}
                onDayClick={handleDayClick}
              />
            ) : (
              <WeekView
                currentDate={currentDate}
                events={events}
                onEventClick={setSelectedEvent}
              />
            )}
          </div>

          {selectedEvent && (
            <EventDetailPanel
              event={selectedEvent}
              onClose={() => setSelectedEvent(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
