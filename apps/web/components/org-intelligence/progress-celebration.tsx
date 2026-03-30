"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProgressCelebrationProps {
  title: string;
  message: string;
  stats?: { label: string; value: string | number }[];
  actions: { label: string; href: string }[];
  onDismiss: () => void;
  className?: string;
}

export function ProgressCelebration({
  title,
  message,
  stats,
  actions,
  onDismiss,
  className,
}: ProgressCelebrationProps) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-emerald-200 bg-emerald-50/80 px-5 py-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40",
        className,
      )}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 text-emerald-400 transition-colors hover:text-emerald-700 dark:hover:text-emerald-200"
        aria-label="Cerrar"
      >
        <svg
          className="size-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300">
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <h4 className="font-bold text-emerald-900 dark:text-emerald-100">
              {title}
            </h4>
            <p className="mt-0.5 text-emerald-700 dark:text-emerald-300">
              {message}
            </p>
          </div>

          {stats && stats.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-md bg-emerald-100/80 px-3 py-1.5 dark:bg-emerald-900/50"
                >
                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">
                    {stat.value}
                  </span>{" "}
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {actions.map((action, idx) => (
                <Button
                  key={action.href}
                  variant={idx === 0 ? "default" : "outline"}
                  size="sm"
                  asChild
                >
                  <Link href={action.href}>{action.label}</Link>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
