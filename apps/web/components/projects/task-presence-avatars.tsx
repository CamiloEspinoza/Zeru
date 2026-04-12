"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";

interface TaskPresenceAvatarsProps {
  projectId: string;
  taskId: string;
}

const EMPTY_USERS: PresenceUser[] = [];

export function TaskPresenceAvatars({ projectId, taskId }: TaskPresenceAvatarsProps) {
  const viewPath = `/projects/${projectId}/task/${taskId}`;
  const users = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? EMPTY_USERS);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Viendo:</span>
      <div className="flex items-center -space-x-1">
        {users.slice(0, 5).map((user: PresenceUser) => (
          <Tooltip key={user.userId}>
            <TooltipTrigger asChild>
              <div>
                <UserAvatar
                  name={user.name}
                  avatarUrl={user.avatar}
                  className="size-5 ring-2 ring-background"
                  fallbackColor={user.color}
                  fallbackClassName="text-[8px]"
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{user.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
