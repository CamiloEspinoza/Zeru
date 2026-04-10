"use client";

import type { CalendarEvent } from "@/hooks/use-calendar-events";
import { EventChip } from "./event-chip";

const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const MAX_VISIBLE = 3;

interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDayClick: (date: Date) => void;
}

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDayClick,
}: MonthViewProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const eventsByDay: Record<number, CalendarEvent[]> = {};
  for (const event of events) {
    const d = new Date(event.start);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_NAMES.map((day) => (
          <div
            key={day}
            className="py-2 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 grid-rows-[repeat(auto-fill,minmax(0,1fr))]">
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDay + 1;
          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
          const isToday =
            isCurrentMonth &&
            dayNum === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();
          const dayEvents = isCurrentMonth ? (eventsByDay[dayNum] ?? []) : [];

          return (
            <div
              key={idx}
              className={`min-h-[100px] border-b border-r p-1 ${
                !isCurrentMonth ? "bg-muted/10" : "cursor-pointer hover:bg-muted/20"
              }`}
              onClick={() =>
                isCurrentMonth && onDayClick(new Date(year, month, dayNum))
              }
            >
              {isCurrentMonth && (
                <>
                  <div
                    className={`mb-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {dayNum}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, MAX_VISIBLE).map((event) => (
                      <EventChip
                        key={event.id}
                        event={event}
                        onClick={onEventClick}
                        compact
                      />
                    ))}
                    {dayEvents.length > MAX_VISIBLE && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{dayEvents.length - MAX_VISIBLE} mas
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
