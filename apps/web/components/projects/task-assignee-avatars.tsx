"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types/projects";

interface TaskAssigneeAvatarsProps {
  assignees: Array<{ userId: string; user: UserSummary }>;
  max?: number;
  size?: "sm" | "md";
}

export function TaskAssigneeAvatars({ assignees, max = 3, size = "sm" }: TaskAssigneeAvatarsProps) {
  if (!assignees.length) return null;
  const visible = assignees.slice(0, max);
  const extra = assignees.length - max;
  const sizeClass = size === "sm" ? "size-6" : "size-8";

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((a) => (
        <UserAvatar
          key={a.userId}
          name={`${a.user.firstName} ${a.user.lastName}`}
          avatarUrl={a.user.avatarUrl}
          className={cn(sizeClass, "border-2 border-background")}
        />
      ))}
      {extra > 0 && (
        <Avatar className={cn(sizeClass, "border-2 border-background")}>
          <AvatarFallback>+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
