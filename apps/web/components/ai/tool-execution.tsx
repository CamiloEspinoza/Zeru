"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type ToolStatus = "running" | "done" | "error";

interface ToolExecutionProps {
  toolCallId: string;
  name: string;
  label: string;
  args?: Record<string, unknown>;
  status: ToolStatus;
  result?: unknown;
  summary?: string;
}

const TOOL_ICONS: Record<string, string> = {
  list_accounts: "📋",
  create_account: "➕",
  create_journal_entry: "📝",
  list_fiscal_periods: "📅",
  get_trial_balance: "⚖️",
  ask_user_question: "❓",
  get_skill_reference: "📚",
};

export function ToolExecution({
  name,
  label,
  args,
  status,
  result,
  summary,
}: ToolExecutionProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[name] ?? "🔧";
  const hasDetails = (args && Object.keys(args).length > 0) || result !== undefined;

  const isSkillRef = name === "get_skill_reference";
  const skillName = isSkillRef && args?.skill_name ? String(args.skill_name) : null;
  const skillFilePath = isSkillRef && args?.file_path ? String(args.file_path) : null;

  return (
    <div
      className={cn(
        "my-1 rounded border text-xs transition-colors",
        isSkillRef
          ? status === "running"
            ? "border-purple-200/50 bg-purple-50/30 dark:border-purple-800/40 dark:bg-purple-950/20"
            : status === "done"
            ? "border-purple-300/60 bg-purple-50/40 dark:border-purple-700/40 dark:bg-purple-950/20"
            : "border-destructive/30 bg-destructive/5"
          : status === "running"
          ? "border-border/50 bg-muted/20"
          : status === "done"
          ? "border-green-200/60 bg-green-50/30 dark:border-green-800/40 dark:bg-green-950/20"
          : "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Status indicator */}
        {status === "running" ? (
          <div className={cn(
            "h-3 w-3 rounded-full border animate-spin flex-shrink-0",
            isSkillRef
              ? "border-purple-400/60 border-t-purple-500"
              : "border-muted-foreground/40 border-t-muted-foreground"
          )} />
        ) : status === "done" ? (
          <svg
            className={cn("h-3 w-3 flex-shrink-0", isSkillRef ? "text-purple-600 dark:text-purple-400" : "text-green-600 dark:text-green-400")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg
            className="h-3 w-3 text-destructive flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}

        {/* Icon + label */}
          <span className={cn("flex items-center gap-1", isSkillRef ? "text-purple-700 dark:text-purple-300" : "text-muted-foreground")}>
          <span>{icon}</span>
          <span className={cn(status === "running" && "animate-pulse")}>
            {isSkillRef && skillName ? (
              skillFilePath
                ? <>Leyendo referencia <span className="font-semibold">{skillName}</span><span className="opacity-60 text-[10px] ml-1">/{skillFilePath}</span></>
                : <>Consultando skill <span className="font-semibold">{skillName}</span></>
            ) : (
              label
            )}
          </span>
        </span>

        {/* Summary on done */}
        {summary && status !== "running" && (
          <span
            className={cn(
              "ml-1 font-medium",
              status === "done" ? "text-foreground/70" : "text-destructive"
            )}
          >
            — {summary}
          </span>
        )}

        {/* Expand button */}
        {hasDetails && status !== "running" && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-auto text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg
              className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && hasDetails && (
        <div className="border-t border-border/30 px-3 pb-3 pt-2 space-y-2">
          {args && Object.keys(args).length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1 font-medium">Argumentos:</p>
              <pre className="rounded bg-muted/50 p-2 text-xs overflow-auto max-h-32 font-mono">
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="text-muted-foreground mb-1 font-medium">Resultado:</p>
              <pre className="rounded bg-muted/50 p-2 text-xs overflow-auto max-h-40 font-mono">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
