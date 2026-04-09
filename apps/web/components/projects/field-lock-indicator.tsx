"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { SquareLock02Icon } from "@hugeicons/core-free-icons";

interface FieldLockIndicatorProps {
  lockedByName: string | null;
}

export function FieldLockIndicator({ lockedByName }: FieldLockIndicatorProps) {
  if (!lockedByName) return null;
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <HugeiconsIcon icon={SquareLock02Icon} className="size-3.5" />
      <span>{lockedByName} está editando...</span>
    </div>
  );
}
