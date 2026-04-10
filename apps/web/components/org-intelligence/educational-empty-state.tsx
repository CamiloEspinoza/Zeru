"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EducationalEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string | React.ReactNode;
  action: { label: string; onClick: () => void };
  secondaryAction?: { label: string; href: string };
  tip?: string;
  className?: string;
}

export function EducationalEmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  tip,
  className,
}: EducationalEmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-12 text-center dark:bg-muted/10",
        className,
      )}
    >
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
        {icon}
      </div>

      <h3 className="mb-2 text-base font-bold tracking-tight">{title}</h3>

      <div className="mb-6 max-w-md text-sm text-muted-foreground">
        {typeof description === "string" ? <p>{description}</p> : description}
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" onClick={action.onClick}>
          {action.label}
        </Button>

        {secondaryAction && (
          <Link
            href={secondaryAction.href}
            className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
          >
            {secondaryAction.label}
          </Link>
        )}
      </div>

      {tip && (
        <div className="mt-8 flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-left text-xs text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
          <svg
            className="mt-0.5 size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>{tip}</span>
        </div>
      )}
    </div>
  );
}
