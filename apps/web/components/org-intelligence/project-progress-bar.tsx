"use client";

import { cn } from "@/lib/utils";

type ProgressStage =
  | "personas"
  | "entrevistas"
  | "analisis"
  | "diagnostico"
  | "plan";

const STAGES: { id: ProgressStage; label: string; color: string }[] = [
  {
    id: "personas",
    label: "Personas",
    color: "bg-blue-500 dark:bg-blue-400",
  },
  {
    id: "entrevistas",
    label: "Entrevistas",
    color: "bg-indigo-500 dark:bg-indigo-400",
  },
  {
    id: "analisis",
    label: "Análisis",
    color: "bg-purple-500 dark:bg-purple-400",
  },
  {
    id: "diagnostico",
    label: "Diagnóstico",
    color: "bg-amber-500 dark:bg-amber-400",
  },
  {
    id: "plan",
    label: "Plan",
    color: "bg-emerald-500 dark:bg-emerald-400",
  },
];

type StageStatus = "pending" | "in-progress" | "completed";

interface ProjectProgressBarProps {
  /** Status of each stage, keyed by stage id */
  stages: Partial<Record<ProgressStage, StageStatus>>;
  className?: string;
}

export function ProjectProgressBar({
  stages,
  className,
}: ProjectProgressBarProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {/* Bar */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {STAGES.map((stage) => {
          const status = stages[stage.id] ?? "pending";
          return (
            <div
              key={stage.id}
              className={cn(
                "h-full flex-1 transition-colors duration-500",
                status === "completed" && stage.color,
                status === "in-progress" &&
                  cn(stage.color, "animate-pulse opacity-60"),
                status === "pending" && "bg-transparent",
              )}
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex w-full">
        {STAGES.map((stage) => {
          const status = stages[stage.id] ?? "pending";
          return (
            <div
              key={stage.id}
              className="flex flex-1 flex-col items-center gap-0.5"
            >
              <div
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[8px] font-bold",
                  status === "completed" &&
                    cn(stage.color, "text-white"),
                  status === "in-progress" &&
                    "border-2 border-current text-muted-foreground",
                  status === "pending" &&
                    "border border-muted-foreground/30 text-muted-foreground/50",
                )}
              >
                {status === "completed" ? (
                  <svg
                    className="size-2.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                ) : null}
              </div>
              <span
                className={cn(
                  "text-[10px] leading-tight",
                  status === "completed"
                    ? "font-medium text-foreground"
                    : "text-muted-foreground",
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
