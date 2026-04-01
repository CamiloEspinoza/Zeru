# Unified Calendar — Design Spec

**Date:** 2026-03-31
**Goal:** Replace the current LinkedIn-only calendar with a full-width, multi-source unified calendar that aggregates events from LinkedIn, Interviews, Accounting, and Automations.

---

## Layout

The calendar occupies the **full width** of the content area (no `max-w-5xl`). The structure is:

```
[Nav sidebar (collapsible)] [Calendar sidebar (240px)] [Calendar full-width]
```

The calendar page uses a dedicated `layout.tsx` that removes the default `p-6` padding, allowing the calendar to fill the available space edge-to-edge.

### Calendar Sidebar (240px, left)

1. **Mini month navigator** — clickable date grid to jump to any date
2. **"Hoy" button** — returns to current date
3. **"Calendarios" section** — checkboxes with colored dots to toggle sources:
   - LinkedIn Posts (blue `#0077B5`)
   - Entrevistas (purple `#8B5CF6`)
   - Contabilidad (amber `#F59E0B`)
   - Automatizaciones (red `#EF4444`)

### Calendar Header

- **Left:** Prev/next arrows + month/week title (e.g., "Marzo 2026")
- **Right:** ToggleGroup (shadcn) for Month/Week view switching

### Views

**Month view:**
- 7-column grid (Lun–Dom)
- Events rendered as small colored chips with truncated text
- Max 2-3 visible per day; "+N más" overflow indicator
- Click empty day → switches to week view on that day

**Week view:**
- 7-column grid with hourly rows (08:00–20:00 visible, scrollable)
- Events as positioned color blocks with title
- All-day events in a top bar above the hourly grid

### Event Detail (Side Panel)

Clicking any event opens a **right-side panel (~350px)** with:
- Event title
- Source badge (colored, e.g., "LinkedIn", "Entrevista")
- Date/time
- Status badge
- Source-specific metadata (post content preview, interview participants, etc.)
- "Abrir" button → navigates to the original resource page

Panel closes on `Esc` or clicking outside.

### Keyboard Shortcuts

- `M` — switch to month view
- `W` — switch to week view
- `T` — jump to today
- `Esc` — close detail panel

---

## Data Model

### Normalized Event

All sources are transformed to a common structure:

```typescript
interface CalendarEvent {
  id: string;
  title: string;
  start: string;       // ISO datetime
  end?: string;        // ISO datetime, null for point-in-time events
  allDay: boolean;
  source: 'linkedin' | 'interviews' | 'accounting' | 'automations';
  status?: string;     // source-specific status
  color: string;       // derived from source
  metadata: Record<string, unknown>;  // source-specific data
  href: string;        // frontend route to the resource
}
```

### Source Color Map

| Source | Color | Tailwind BG | Tailwind Text |
|--------|-------|-------------|---------------|
| LinkedIn | `#0077B5` | `bg-sky-100 dark:bg-sky-900/30` | `text-sky-700 dark:text-sky-300` |
| Entrevistas | `#8B5CF6` | `bg-violet-100 dark:bg-violet-900/30` | `text-violet-700 dark:text-violet-300` |
| Contabilidad | `#F59E0B` | `bg-amber-100 dark:bg-amber-900/30` | `text-amber-700 dark:text-amber-300` |
| Automatizaciones | `#EF4444` | `bg-red-100 dark:bg-red-900/30` | `text-red-700 dark:text-red-300` |

---

## API

### Endpoint

```
GET /calendar/events?from=2026-03-01T00:00:00Z&to=2026-03-31T23:59:59Z&sources=linkedin,interviews,accounting
```

**Query parameters:**
- `from` (required): ISO date, start of range
- `to` (required): ISO date, end of range
- `sources` (optional): comma-separated list of sources to include. Defaults to all.

**Response:**
```json
{
  "data": [
    {
      "id": "post-uuid",
      "title": "LinkedIn: Título del post...",
      "start": "2026-03-15T10:00:00Z",
      "end": null,
      "allDay": false,
      "source": "linkedin",
      "status": "SCHEDULED",
      "color": "#0077B5",
      "metadata": { "contentPillar": "tips", "mediaType": "IMAGE" },
      "href": "/linkedin/posts/post-uuid"
    }
  ]
}
```

### Backend Implementation

No new database table. The `CalendarService` aggregates from existing tables:

| Source | Table | Date Field | Title Source |
|--------|-------|------------|-------------|
| LinkedIn | `LinkedInPost` | `scheduledAt` / `publishedAt` | Content truncated to 60 chars |
| Entrevistas | `Interview` | `interviewDate` / `createdAt` | `title` field |
| Contabilidad | `AccountingPeriod` | `endDate` | Period name + "Cierre" |
| Automatizaciones | Future table | Scheduled date | Task title |

For Automations: since the table doesn't exist yet, the service returns an empty array for this source. The frontend shows the filter toggle disabled with "(Próximamente)" label.

The service queries each source in parallel with `Promise.all` and merges results into the normalized array.

---

## Frontend Architecture

### New Files

| File | Responsibility |
|------|---------------|
| `app/(dashboard)/calendar/layout.tsx` | Removes default padding for full-width |
| `app/(dashboard)/calendar/page.tsx` | Rewrite — orchestrates sidebar + calendar + panel |
| `components/calendar/calendar-sidebar.tsx` | Mini-cal + source filter checkboxes |
| `components/calendar/calendar-header.tsx` | Navigation arrows + month title + view toggle |
| `components/calendar/month-view.tsx` | 7-col month grid with event chips |
| `components/calendar/week-view.tsx` | 7-col week grid with hourly rows |
| `components/calendar/event-chip.tsx` | Small colored event indicator |
| `components/calendar/event-detail-panel.tsx` | Right side panel for event details |
| `hooks/use-calendar-events.ts` | Fetch + cache events for date range |

### Backend Files

| File | Responsibility |
|------|---------------|
| `modules/calendar/calendar.module.ts` | NestJS module |
| `modules/calendar/calendar.controller.ts` | `GET /calendar/events` endpoint |
| `modules/calendar/calendar.service.ts` | Aggregates events from all sources |

### No External Library

The calendar is built custom with Tailwind CSS, following the existing pattern of the current calendar. This gives full design control and zero additional dependencies.

### State Management

The `page.tsx` manages:
- `currentDate`: the focused date (determines which month/week to show)
- `view`: `'month' | 'week'`
- `enabledSources`: `Set<string>` of active source filters
- `selectedEvent`: the event shown in the detail panel (null when closed)

The `useCalendarEvents` hook:
- Accepts `{ from, to, sources }` params
- Fetches from `GET /calendar/events`
- Re-fetches when date range or sources change
- Returns `{ events, loading }`

### Interactions

- Click empty day (month view) → switch to week view for that day
- Click event → open detail panel
- Click "Abrir" in panel → navigate to resource page
- Toggle checkbox in sidebar → filter events
- Click date in mini-cal → jump to that date
- Prev/next arrows → navigate month or week
- "Hoy" button → return to current date
