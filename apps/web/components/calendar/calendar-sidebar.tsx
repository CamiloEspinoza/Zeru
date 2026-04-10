"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

const MONTH_NAMES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];
const DAY_HEADERS = ["L", "M", "X", "J", "V", "S", "D"];

interface SourceConfig {
  key: string;
  label: string;
  color: string;
  disabled?: boolean;
}

const SOURCES: SourceConfig[] = [
  { key: "linkedin", label: "LinkedIn Posts", color: "#0077B5" },
  { key: "interviews", label: "Entrevistas", color: "#8B5CF6" },
  { key: "accounting", label: "Contabilidad", color: "#F59E0B" },
  { key: "automations", label: "Automatizaciones", color: "#EF4444", disabled: true },
];

interface CalendarSidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  enabledSources: Set<string>;
  onToggleSource: (source: string) => void;
}

function MiniCalendar({
  currentDate,
  onDateSelect,
}: {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayRaw = new Date(year, month, 1).getDay();
  const firstDay = firstDayRaw === 0 ? 6 : firstDayRaw - 1;
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-center">
        {MONTH_NAMES_SHORT[month]} {year}
      </p>
      <div className="grid grid-cols-7 gap-0 text-center">
        {DAY_HEADERS.map((d) => (
          <span key={d} className="text-[10px] text-muted-foreground py-0.5">
            {d}
          </span>
        ))}
        {Array.from({ length: totalCells }).map((_, idx) => {
          const dayNum = idx - firstDay + 1;
          const valid = dayNum >= 1 && dayNum <= daysInMonth;
          const isToday =
            valid &&
            dayNum === today.getDate() &&
            month === today.getMonth() &&
            year === today.getFullYear();

          return (
            <button
              key={idx}
              type="button"
              disabled={!valid}
              onClick={() => valid && onDateSelect(new Date(year, month, dayNum))}
              className={`text-[11px] py-0.5 rounded-full transition-colors ${
                !valid
                  ? "text-transparent cursor-default"
                  : isToday
                    ? "bg-primary text-primary-foreground font-bold"
                    : "hover:bg-muted text-foreground"
              }`}
            >
              {valid ? dayNum : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarSidebar({
  currentDate,
  onDateSelect,
  enabledSources,
  onToggleSource,
}: CalendarSidebarProps) {
  const today = new Date();

  return (
    <div className="flex h-full w-[240px] shrink-0 flex-col border-r bg-background p-4 gap-6">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => onDateSelect(today)}
      >
        Hoy
      </Button>

      <MiniCalendar currentDate={currentDate} onDateSelect={onDateSelect} />

      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Calendarios
        </p>
        {SOURCES.map((source) => (
          <label
            key={source.key}
            className={`flex items-center gap-2.5 text-sm cursor-pointer ${
              source.disabled ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            <Checkbox
              checked={enabledSources.has(source.key)}
              onCheckedChange={() => !source.disabled && onToggleSource(source.key)}
              disabled={source.disabled}
              className="border-2"
              style={
                enabledSources.has(source.key)
                  ? { backgroundColor: source.color, borderColor: source.color }
                  : { borderColor: source.color }
              }
            />
            <span>{source.label}</span>
            {source.disabled && (
              <span className="text-[10px] text-muted-foreground">(Proximamente)</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
