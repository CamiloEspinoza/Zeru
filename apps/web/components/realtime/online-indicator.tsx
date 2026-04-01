"use client";

import { usePresenceStore } from "@/stores/presence-store";
import { cn } from "@/lib/utils";

export function OnlineIndicator({
  userId,
  className,
}: {
  userId: string;
  className?: string;
}) {
  const isOnline = usePresenceStore((s) => s.onlineUsers.includes(userId));

  return (
    <span
      className={cn(
        "inline-block w-2.5 h-2.5 rounded-full",
        isOnline ? "bg-green-500" : "bg-gray-400",
        className,
      )}
    />
  );
}
