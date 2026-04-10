"use client";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface CalendarHeaderProps {
  currentDate: Date;
  view: "month" | "week";
  onViewChange: (view: "month" | "week") => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  loading?: boolean;
}

function getWeekRange(date: Date): string {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });

  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

export function CalendarHeader({
  currentDate,
  view,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  loading,
}: CalendarHeaderProps) {
  const title =
    view === "month"
      ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : getWeekRange(currentDate);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onToday}>
          Hoy
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrev}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Button>
        <h2 className="text-sm font-semibold min-w-[200px]">{title}</h2>
        {loading && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>
      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(v) => { if (v) onViewChange(v as "month" | "week"); }}
        size="sm"
      >
        <ToggleGroupItem value="month">Mes</ToggleGroupItem>
        <ToggleGroupItem value="week">Semana</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
