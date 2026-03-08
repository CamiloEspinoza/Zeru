"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";

interface Post {
  id: string;
  content: string;
  status: string;
  scheduledAt?: string | null;
  contentPillar?: string | null;
  mediaType?: string;
}

interface ListResponse {
  posts: Post[];
  total: number;
}

const PILLAR_COLORS: Record<string, string> = {
  "thought-leadership": "bg-purple-500",
  tips: "bg-blue-500",
  "case-study": "bg-amber-500",
  "industry-news": "bg-red-500",
  "behind-the-scenes": "bg-green-500",
};

const PILLAR_LABELS: Record<string, string> = {
  "thought-leadership": "Liderazgo",
  tips: "Tips",
  "case-study": "Caso de Estudio",
  "industry-news": "Industria",
  "behind-the-scenes": "Behind the Scenes",
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: "bg-blue-500",
  PUBLISHED: "bg-green-500",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday-based (0=Mon...6=Sun)
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "SCHEDULED" | "PUBLISHED">("all");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const [scheduled, published] = await Promise.all([
        api.get<ListResponse>("/linkedin/posts?status=SCHEDULED&perPage=200"),
        api.get<ListResponse>("/linkedin/posts?status=PUBLISHED&perPage=200"),
      ]);
      setPosts([...(scheduled.posts ?? []), ...(published.posts ?? [])]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

  const filteredPosts = posts.filter(p =>
    filter === "all" ? true : p.status === filter
  );

  const postsByDay: Record<number, Post[]> = {};
  for (const post of filteredPosts) {
    const date = post.scheduledAt ? new Date(post.scheduledAt) : null;
    if (!date) continue;
    if (date.getFullYear() === year && date.getMonth() === month) {
      const day = date.getDate();
      if (!postsByDay[day]) postsByDay[day] = [];
      postsByDay[day].push(post);
    }
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Posts programados y publicados en LinkedIn</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as typeof filter)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos</option>
            <option value="SCHEDULED">Programados</option>
            <option value="PUBLISHED">Publicados</option>
          </select>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center gap-4">
        <button
          onClick={prevMonth}
          className="rounded-lg border border-border p-2 hover:bg-muted transition-colors"
          aria-label="Mes anterior"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-medium min-w-[180px] text-center">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="rounded-lg border border-border p-2 hover:bg-muted transition-colors"
          aria-label="Mes siguiente"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        {loading && (
          <svg className="h-4 w-4 animate-spin text-muted-foreground ml-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(PILLAR_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${PILLAR_COLORS[key] ?? "bg-muted-foreground"}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Publicado
        </span>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-border overflow-hidden flex-1">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_NAMES.map(day => (
            <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 divide-x divide-border">
          {Array.from({ length: totalCells }).map((_, idx) => {
            const dayNum = idx - firstDay + 1;
            const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const isToday =
              isCurrentMonth &&
              dayNum === today.getDate() &&
              month === today.getMonth() &&
              year === today.getFullYear();
            const dayPosts = isCurrentMonth ? (postsByDay[dayNum] ?? []) : [];

            return (
              <div
                key={idx}
                className={`min-h-[110px] p-1.5 border-b border-border ${
                  !isCurrentMonth ? "bg-muted/20" : ""
                }`}
              >
                {isCurrentMonth && (
                  <>
                    <div
                      className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground"
                      }`}
                    >
                      {dayNum}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {dayPosts.slice(0, 3).map(post => {
                        const color =
                          post.status === "PUBLISHED"
                            ? STATUS_COLORS["PUBLISHED"]
                            : post.contentPillar
                            ? (PILLAR_COLORS[post.contentPillar] ?? "bg-blue-500")
                            : STATUS_COLORS["SCHEDULED"];
                        return (
                          <button
                            key={post.id}
                            onClick={() => setSelectedPost(post)}
                            className={`w-full rounded px-1.5 py-0.5 text-left text-[10px] text-white truncate ${color} hover:opacity-90 transition-opacity`}
                          >
                            {post.content.split("\n")[0].slice(0, 30)}
                          </button>
                        );
                      })}
                      {dayPosts.length > 3 && (
                        <span className="text-[10px] text-muted-foreground px-1">
                          +{dayPosts.length - 3} más
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

      {/* Post detail popover */}
      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl mx-4"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPost(null)}
              className="absolute right-3 top-3 rounded-md p-1 hover:bg-muted transition-colors text-muted-foreground"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-2 mb-3">
              {selectedPost.status === "PUBLISHED" ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Publicado
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  Programado
                </span>
              )}
              {selectedPost.contentPillar && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {PILLAR_LABELS[selectedPost.contentPillar] ?? selectedPost.contentPillar}
                </span>
              )}
            </div>
            {selectedPost.scheduledAt && (
              <p className="text-xs text-muted-foreground mb-3">
                {new Date(selectedPost.scheduledAt).toLocaleString("es-CL", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto text-foreground">
              {selectedPost.content}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
