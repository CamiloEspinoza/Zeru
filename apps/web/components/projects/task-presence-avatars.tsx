"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";

interface TaskPresenceAvatarsProps {
  projectId: string;
  taskId: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function TaskPresenceAvatars({ projectId, taskId }: TaskPresenceAvatarsProps) {
  const viewPath = `/projects/${projectId}/task/${taskId}`;
  const users = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? []);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Viendo:</span>
      <div className="flex items-center -space-x-1">
        {users.slice(0, 5).map((user: PresenceUser) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <Avatar className="size-5 border-2 border-background">
                <AvatarFallback
                  className="text-[8px] font-medium text-white"
                  style={{ backgroundColor: user.color }}
                >
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>{user.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
