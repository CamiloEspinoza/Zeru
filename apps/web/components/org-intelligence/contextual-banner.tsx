"use client";

import { useState } from "react";
import { useFirstVisit } from "@/hooks/use-first-visit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContextualBannerProps {
  id: string;
  message: string | React.ReactNode;
  variant?: "info" | "success" | "tip";
  dismissLabel?: string;
}

const VARIANT_STYLES: Record<
  string,
  { container: string; icon: string; iconPath: string }
> = {
  info: {
    container:
      "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
    icon: "text-blue-500 dark:text-blue-400",
    iconPath:
      "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  success: {
    container:
      "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/50 dark:text-green-200",
    icon: "text-green-500 dark:text-green-400",
    iconPath:
      "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  },
  tip: {
    container:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
    icon: "text-amber-500 dark:text-amber-400",
    iconPath:
      "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  },
};

export function ContextualBanner({
  id,
  message,
  variant = "info",
  dismissLabel = "Entendido",
}: ContextualBannerProps) {
  const { isFirstVisit, markVisited } = useFirstVisit(`banner_${id}`);
  const [isFading, setIsFading] = useState(false);

  if (!isFirstVisit) return null;

  const styles = VARIANT_STYLES[variant];

  const handleDismiss = () => {
    setIsFading(true);
    setTimeout(() => {
      markVisited();
    }, 300);
  };

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-opacity duration-300",
        styles.container,
        isFading && "opacity-0",
      )}
    >
      <svg
        className={cn("mt-0.5 size-5 shrink-0", styles.icon)}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={styles.iconPath} />
      </svg>

      <div className="flex-1">
        {typeof message === "string" ? <p>{message}</p> : message}
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleDismiss}
        className="shrink-0"
      >
        {dismissLabel}
      </Button>
    </div>
  );
}
