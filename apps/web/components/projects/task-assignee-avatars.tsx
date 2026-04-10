"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types/projects";

interface TaskAssigneeAvatarsProps {
  assignees: Array<{ userId: string; user: UserSummary }>;
  max?: number;
  size?: "sm" | "md";
}

function initials(user: UserSummary): string {
  const first = user.firstName?.charAt(0) ?? "";
  const last = user.lastName?.charAt(0) ?? "";
  return (first + last).toUpperCase() || "?";
}

export function TaskAssigneeAvatars({ assignees, max = 3, size = "sm" }: TaskAssigneeAvatarsProps) {
  if (!assignees.length) return null;
  const visible = assignees.slice(0, max);
  const extra = assignees.length - max;
  const sizeClass = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <Avatar
          key={a.userId}
          className={cn(sizeClass, "border-2 border-background")}
          title={`${a.user.firstName} ${a.user.lastName}`}
        >
          {a.user.avatarUrl && <AvatarImage src={a.user.avatarUrl} alt={a.user.firstName} />}
          <AvatarFallback>{initials(a.user)}</AvatarFallback>
        </Avatar>
      ))}
      {extra > 0 && (
        <Avatar className={cn(sizeClass, "border-2 border-background")}>
          <AvatarFallback>+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
