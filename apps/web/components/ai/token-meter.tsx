"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { TokenUsage } from "@/hooks/use-chat-stream";
import type { ConversationUsageSummary } from "@zeru/shared";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

/** The pricing tier threshold — above this, input/output prices double */
const PRICE_THRESHOLD = 272_000;
/** We target staying under this to leave headroom */
const SOFT_LIMIT = 260_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("access_token");
  const tenantId = localStorage.getItem("tenantId");
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(tenantId ? { "x-tenant-id": tenantId } : {}),
  };
}

interface TokenMeterProps {
  /** Live usage from the current streaming session */
  liveUsage: TokenUsage;
  conversationId?: string;
}

export function TokenMeter({ liveUsage, conversationId }: TokenMeterProps) {
  const [expanded, setExpanded] = useState(false);
  const [serverUsage, setServerUsage] = useState<ConversationUsageSummary | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded]);

  // Fetch cumulative usage from server when conversation changes or live usage updates
  useEffect(() => {
    let cancelled = false;

    const fetchUsage = async () => {
      if (!conversationId) {
        if (!cancelled) setServerUsage(null);
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/ai/conversations/${conversationId}/usage`, {
          headers: getAuthHeaders(),
        });
        if (res.ok && !cancelled) {
          setServerUsage(await res.json());
        }
      } catch {
        // Non-critical
      }
    };

    fetchUsage();
    return () => { cancelled = true; };
  }, [conversationId, liveUsage.totalTokens]);

  // Combine server + live usage
  const totalInput = (serverUsage?.totalInputTokens ?? 0) + liveUsage.inputTokens;
  const totalOutput = (serverUsage?.totalOutputTokens ?? 0) + liveUsage.outputTokens;
  const totalAll = totalInput + totalOutput;
  const cachedTotal = (serverUsage?.totalCachedTokens ?? 0) + liveUsage.cachedTokens;

  // Don't show if no usage yet
  if (totalAll === 0) return null;

  // The relevant metric for the pricing tier is the input_tokens on the LAST request
  // But for a visual indicator, we show cumulative context growth (input tokens = context size)
  const lastInputTokens = liveUsage.inputTokens || (serverUsage?.totalInputTokens ?? 0);
  const percentage = Math.min((lastInputTokens / PRICE_THRESHOLD) * 100, 100);
  const isNearLimit = lastInputTokens >= SOFT_LIMIT;
  const isOverLimit = lastInputTokens >= PRICE_THRESHOLD;

  const barColor = isOverLimit
    ? "bg-red-500"
    : isNearLimit
      ? "bg-amber-500"
      : "bg-emerald-500";

  const statusColor = isOverLimit
    ? "text-red-400"
    : isNearLimit
      ? "text-amber-400"
      : "text-muted-foreground";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 rounded-full px-3 py-1 text-xs transition-colors",
          "bg-muted/50 hover:bg-muted/80 border border-border/50"
        )}
      >
        {/* Mini progress bar */}
        <div className="relative h-1.5 w-16 rounded-full bg-muted overflow-hidden">
          <div
            className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-500", barColor)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn("tabular-nums font-mono", statusColor)}>
          {formatTokens(lastInputTokens)}/{formatTokens(PRICE_THRESHOLD)}
        </span>
        <svg
          className={cn("h-3 w-3 text-muted-foreground transition-transform", expanded && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-popover p-3 shadow-lg">
          <div className="space-y-3">
            {/* Progress bar (large) */}
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Contexto actual</span>
                <span className={cn("font-mono tabular-nums", statusColor)}>
                  {percentage.toFixed(0)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", barColor)}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 mt-0.5">
                <span>0</span>
                <span className="text-amber-400/60">260K</span>
                <span className="text-red-400/60">272K</span>
              </div>
              {isOverLimit && (
                <p className="text-[10px] text-red-400 mt-1">
                  Precio duplicado activo (sobre 272K)
                </p>
              )}
              {isNearLimit && !isOverLimit && (
                <p className="text-[10px] text-amber-400 mt-1">
                  Cerca del umbral — compactación activada
                </p>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-foreground">Uso acumulado</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                <span className="text-muted-foreground">Input</span>
                <span className="text-right font-mono tabular-nums">{formatTokens(totalInput)}</span>
                <span className="text-muted-foreground">Output</span>
                <span className="text-right font-mono tabular-nums">{formatTokens(totalOutput)}</span>
                <span className="text-muted-foreground">Cached</span>
                <span className="text-right font-mono tabular-nums text-emerald-400">{formatTokens(cachedTotal)}</span>
                <span className="text-muted-foreground font-medium">Total</span>
                <span className="text-right font-mono tabular-nums font-medium">{formatTokens(totalAll)}</span>
              </div>
            </div>

            {/* By model breakdown */}
            {serverUsage?.byModel && serverUsage.byModel.length > 0 && (
              <div className="space-y-1 border-t border-border/50 pt-2">
                <h4 className="text-xs font-medium text-foreground">Por modelo</h4>
                {serverUsage.byModel.map((m) => (
                  <div key={`${m.provider}:${m.model}`} className="text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground truncate max-w-[160px]">
                        {m.model}
                      </span>
                      <span className="font-mono tabular-nums text-right">
                        {formatTokens(m.totalTokens)}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-muted-foreground/60 pl-2">
                      <span>In: {formatTokens(m.inputTokens)}</span>
                      <span>Out: {formatTokens(m.outputTokens)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
