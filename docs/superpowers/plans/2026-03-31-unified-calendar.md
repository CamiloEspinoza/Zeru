# Unified Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the LinkedIn-only calendar with a full-width, multi-source unified calendar with sidebar filters, month/week views, and event detail side panel.

**Architecture:** New NestJS `CalendarModule` aggregates events from `LinkedInPost`, `Interview`, and `FiscalPeriod` tables into a normalized `CalendarEvent` shape. Frontend is a full rewrite of the calendar page with dedicated sidebar, month/week views, and detail panel — all custom Tailwind (no external calendar library).

**Tech Stack:** Next.js App Router, React, Tailwind CSS, shadcn/ui (ToggleGroup, Checkbox, Collapsible), NestJS, Prisma.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/api/src/modules/calendar/calendar.module.ts` | Create | NestJS module registration |
| `apps/api/src/modules/calendar/calendar.controller.ts` | Create | `GET /calendar/events` endpoint |
| `apps/api/src/modules/calendar/calendar.service.ts` | Create | Aggregate events from all sources |
| `apps/api/src/app.module.ts` | Modify | Register CalendarModule |
| `apps/web/hooks/use-calendar-events.ts` | Create | Fetch + cache calendar events |
| `apps/web/components/calendar/calendar-sidebar.tsx` | Create | Mini-cal + source filter checkboxes |
| `apps/web/components/calendar/calendar-header.tsx` | Create | Navigation + view toggle |
| `apps/web/components/calendar/month-view.tsx` | Create | 7-col month grid |
| `apps/web/components/calendar/week-view.tsx` | Create | 7-col hourly grid |
| `apps/web/components/calendar/event-chip.tsx` | Create | Colored event chip |
| `apps/web/components/calendar/event-detail-panel.tsx` | Create | Right side panel |
| `apps/web/app/(dashboard)/calendar/layout.tsx` | Create | Remove padding for full-width |
| `apps/web/app/(dashboard)/calendar/page.tsx` | Rewrite | Orchestrate all components |

---

### Task 1: Backend — CalendarModule, Controller, Service

**Files:**
- Create: `apps/api/src/modules/calendar/calendar.module.ts`
- Create: `apps/api/src/modules/calendar/calendar.controller.ts`
- Create: `apps/api/src/modules/calendar/calendar.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create CalendarService**

```typescript
// apps/api/src/modules/calendar/calendar.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  source: 'linkedin' | 'interviews' | 'accounting' | 'automations';
  status?: string;
  color: string;
  metadata: Record<string, unknown>;
  href: string;
}

const SOURCE_COLORS = {
  linkedin: '#0077B5',
  interviews: '#8B5CF6',
  accounting: '#F59E0B',
  automations: '#EF4444',
};

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async getEvents(
    tenantId: string,
    from: Date,
    to: Date,
    sources: string[],
  ): Promise<CalendarEvent[]> {
    const results: CalendarEvent[][] = await Promise.all([
      sources.includes('linkedin') ? this.getLinkedInEvents(tenantId, from, to) : [],
      sources.includes('interviews') ? this.getInterviewEvents(tenantId, from, to) : [],
      sources.includes('accounting') ? this.getAccountingEvents(tenantId, from, to) : [],
    ]);

    return results.flat().sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  private async getLinkedInEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const posts = await client.linkedInPost.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { scheduledAt: { gte: from, lte: to } },
          { publishedAt: { gte: from, lte: to } },
        ],
      },
      orderBy: { scheduledAt: 'asc' },
    });

    return posts.map((p) => ({
      id: p.id,
      title: p.content.split('\n')[0].slice(0, 60),
      start: (p.scheduledAt ?? p.publishedAt ?? p.createdAt).toISOString(),
      allDay: false,
      source: 'linkedin' as const,
      status: p.status,
      color: SOURCE_COLORS.linkedin,
      metadata: {
        content: p.content,
        contentPillar: p.contentPillar,
        mediaType: p.mediaType,
      },
      href: `/linkedin/posts`,
    }));
  }

  private async getInterviewEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const interviews = await client.interview.findMany({
      where: {
        tenantId,
        deletedAt: null,
        interviewDate: { gte: from, lte: to },
      },
      include: { speakers: { select: { name: true, isInterviewer: true } }, project: { select: { id: true, name: true } } },
      orderBy: { interviewDate: 'asc' },
    });

    return interviews.map((i) => ({
      id: i.id,
      title: i.title ?? 'Entrevista sin título',
      start: (i.interviewDate ?? i.createdAt).toISOString(),
      allDay: true,
      source: 'interviews' as const,
      status: i.processingStatus,
      color: SOURCE_COLORS.interviews,
      metadata: {
        speakers: i.speakers.map((s) => s.name ?? 'Sin nombre'),
        projectName: (i.project as { name?: string })?.name ?? '',
        projectId: i.projectId,
      },
      href: `/org-intelligence/projects/${i.projectId}/interviews/${i.id}`,
    }));
  }

  private async getAccountingEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const periods = await client.fiscalPeriod.findMany({
      where: {
        tenantId,
        deletedAt: null,
        endDate: { gte: from, lte: to },
      },
      orderBy: { endDate: 'asc' },
    });

    return periods.map((p) => ({
      id: p.id,
      title: `Cierre: ${p.name}`,
      start: p.endDate.toISOString(),
      allDay: true,
      source: 'accounting' as const,
      status: p.status,
      color: SOURCE_COLORS.accounting,
      metadata: { periodName: p.name },
      href: `/accounting/periods`,
    }));
  }
}
```

- [ ] **Step 2: Create CalendarController**

```typescript
// apps/api/src/modules/calendar/calendar.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CalendarService } from './calendar.service';

@Controller('calendar')
@UseGuards(JwtAuthGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get('events')
  async getEvents(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('sources') sources: string | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    const sourceList = sources
      ? sources.split(',').map((s) => s.trim())
      : ['linkedin', 'interviews', 'accounting'];

    const events = await this.calendarService.getEvents(
      tenantId,
      new Date(from),
      new Date(to),
      sourceList,
    );

    return { data: events };
  }
}
```

- [ ] **Step 3: Create CalendarModule**

```typescript
// apps/api/src/modules/calendar/calendar.module.ts
import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
```

- [ ] **Step 4: Register CalendarModule in AppModule**

In `apps/api/src/app.module.ts`, add:

```typescript
import { CalendarModule } from './modules/calendar/calendar.module';
```

And add `CalendarModule` to the `imports` array.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/calendar/ apps/api/src/app.module.ts
git commit -m "feat(calendar): add CalendarModule with unified events endpoint"
```

---

### Task 2: Frontend — useCalendarEvents hook

**Files:**
- Create: `apps/web/hooks/use-calendar-events.ts`

- [ ] **Step 1: Create the hook**

```typescript
// apps/web/hooks/use-calendar-events.ts
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

  const fetchEvents = useCallback(async () => {
    if (sources.size === 0) {
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        sources: Array.from(sources).join(","),
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
  }, [from.toISOString(), to.toISOString(), Array.from(sources).join(",")]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/hooks/use-calendar-events.ts
git commit -m "feat(calendar): add useCalendarEvents hook"
```

---

### Task 3: Frontend — EventChip component

**Files:**
- Create: `apps/web/components/calendar/event-chip.tsx`

- [ ] **Step 1: Create EventChip**

```tsx
// apps/web/components/calendar/event-chip.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/event-chip.tsx
git commit -m "feat(calendar): add EventChip component"
```

---

### Task 4: Frontend — CalendarHeader component

**Files:**
- Create: `apps/web/components/calendar/calendar-header.tsx`

- [ ] **Step 1: Create CalendarHeader**

```tsx
// apps/web/components/calendar/calendar-header.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/calendar-header.tsx
git commit -m "feat(calendar): add CalendarHeader with view toggle"
```

---

### Task 5: Frontend — CalendarSidebar component

**Files:**
- Create: `apps/web/components/calendar/calendar-sidebar.tsx`

- [ ] **Step 1: Create CalendarSidebar**

```tsx
// apps/web/components/calendar/calendar-sidebar.tsx
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
              <span className="text-[10px] text-muted-foreground">(Próximamente)</span>
            )}
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/calendar-sidebar.tsx
git commit -m "feat(calendar): add CalendarSidebar with mini-cal and source filters"
```

---

### Task 6: Frontend — MonthView component

**Files:**
- Create: `apps/web/components/calendar/month-view.tsx`

- [ ] **Step 1: Create MonthView**

```tsx
// apps/web/components/calendar/month-view.tsx
"use client";

import type { CalendarEvent } from "@/hooks/use-calendar-events";
import { EventChip } from "./event-chip";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
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
      {/* Day headers */}
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

      {/* Day cells */}
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
                        +{dayEvents.length - MAX_VISIBLE} más
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/month-view.tsx
git commit -m "feat(calendar): add MonthView component"
```

---

### Task 7: Frontend — WeekView component

**Files:**
- Create: `apps/web/components/calendar/week-view.tsx`

- [ ] **Step 1: Create WeekView**

```tsx
// apps/web/components/calendar/week-view.tsx
"use client";

import type { CalendarEvent } from "@/hooks/use-calendar-events";
import { EventChip } from "./event-chip";

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 08:00–20:00

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
      {/* Day headers */}
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

      {/* All-day row */}
      {hasAllDay && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
          <div className="flex items-center justify-center text-[10px] text-muted-foreground">
            Todo el día
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

      {/* Hourly grid */}
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/week-view.tsx
git commit -m "feat(calendar): add WeekView component with hourly grid"
```

---

### Task 8: Frontend — EventDetailPanel component

**Files:**
- Create: `apps/web/components/calendar/event-detail-panel.tsx`

- [ ] **Step 1: Create EventDetailPanel**

```tsx
// apps/web/components/calendar/event-detail-panel.tsx
"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { CalendarEvent } from "@/hooks/use-calendar-events";

const SOURCE_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  interviews: "Entrevista",
  accounting: "Contabilidad",
  automations: "Automatización",
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
      {/* Header */}
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

      {/* Content */}
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

        {/* Source-specific metadata */}
        {event.source === "linkedin" && meta.content && (
          <div className="rounded-md border p-3">
            <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {String(meta.content).slice(0, 500)}
            </p>
          </div>
        )}

        {event.source === "interviews" && (
          <div className="space-y-2">
            {meta.projectName && (
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

        {event.source === "accounting" && meta.periodName && (
          <p className="text-sm">
            <span className="text-muted-foreground">Periodo:</span>{" "}
            {String(meta.periodName)}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="border-t p-4">
        <Button asChild className="w-full">
          <Link href={event.href}>Abrir</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/calendar/event-detail-panel.tsx
git commit -m "feat(calendar): add EventDetailPanel side panel"
```

---

### Task 9: Frontend — Calendar layout and page rewrite

**Files:**
- Create: `apps/web/app/(dashboard)/calendar/layout.tsx`
- Rewrite: `apps/web/app/(dashboard)/calendar/page.tsx`

- [ ] **Step 1: Create calendar layout (removes padding for full-width)**

```tsx
// apps/web/app/(dashboard)/calendar/layout.tsx
export default function CalendarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="flex flex-1 flex-col min-h-0 -m-6">{children}</div>;
}
```

The `-m-6` counteracts the `p-6` from the parent dashboard layout's `<main>`, making the calendar content fill the entire area.

- [ ] **Step 2: Rewrite calendar page**

```tsx
// apps/web/app/(dashboard)/calendar/page.tsx
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
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Fix any lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/calendar/layout.tsx apps/web/app/\(dashboard\)/calendar/page.tsx
git commit -m "feat(calendar): rewrite calendar page with full-width layout, sidebar, and side panel"
```

---

### Task 10: Final verification

- [ ] **Step 1: Run full lint**

```bash
pnpm lint
```

- [ ] **Step 2: Verify build**

```bash
pnpm --filter @zeru/web build
```

- [ ] **Step 3: Fix any errors and commit**

```bash
git add -A
git commit -m "chore: lint and build fixes for unified calendar"
```
