"use client";

import type { ReactNode } from "react";

interface TaskPropertyRowProps {
  label: string;
  children: ReactNode;
}

export function TaskPropertyRow({ label, children }: TaskPropertyRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground pt-1">
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
