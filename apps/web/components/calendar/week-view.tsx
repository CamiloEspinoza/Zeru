"use client";

import type { CalendarEvent } from "@/hooks/use-calendar-events";
import { EventChip } from "./event-chip";

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

interface WeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

function getWeekDays(date: Date): Date[] {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear()
  );
}

export function WeekView({
  currentDate,
  events,
  onEventClick,
}: WeekViewProps) {
  const weekDays = getWeekDays(currentDate);
  const today = new Date();

  const allDayEvents: Record<number, CalendarEvent[]> = {};
  const timedEvents: Record<number, CalendarEvent[]> = {};

  for (const event of events) {
    const d = new Date(event.start);
    const dayIdx = weekDays.findIndex((wd) => isSameDay(wd, d));
    if (dayIdx === -1) continue;
    if (event.allDay) {
      if (!allDayEvents[dayIdx]) allDayEvents[dayIdx] = [];
      allDayEvents[dayIdx].push(event);
    } else {
      if (!timedEvents[dayIdx]) timedEvents[dayIdx] = [];
      timedEvents[dayIdx].push(event);
    }
  }

  const hasAllDay = Object.keys(allDayEvents).length > 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b bg-muted/30">
        <div />
        {weekDays.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={i} className="py-2 text-center">
              <span className="text-xs text-muted-foreground">{DAY_NAMES[i]}</span>
              <div
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {hasAllDay && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="flex items-center justify-center text-[10px] text-muted-foreground">
            Todo el dia
          </div>
          {weekDays.map((_, i) => (
            <div key={i} className="border-l p-0.5 space-y-0.5">
              {(allDayEvents[i] ?? []).map((event) => (
                <EventChip key={event.id} event={event} onClick={onEventClick} />
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-[60px_repeat(7,1fr)]">
          {HOURS.map((hour) => (
            <div key={hour} className="contents">
              <div className="flex h-14 items-start justify-end pr-2 pt-0.5 text-[10px] text-muted-foreground border-b">
                {String(hour).padStart(2, "0")}:00
              </div>
              {weekDays.map((_, dayIdx) => {
                const hourEvents = (timedEvents[dayIdx] ?? []).filter((e) => {
                  const h = new Date(e.start).getHours();
                  return h === hour;
                });
                return (
                  <div
                    key={dayIdx}
                    className="relative h-14 border-b border-l p-0.5"
                  >
                    {hourEvents.map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
