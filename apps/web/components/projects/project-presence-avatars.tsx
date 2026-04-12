"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";
import { usePathname } from "next/navigation";

interface ProjectPresenceAvatarsProps {
  projectId: string;
  max?: number;
}

const EMPTY_USERS: PresenceUser[] = [];

export function ProjectPresenceAvatars({ projectId, max = 4 }: ProjectPresenceAvatarsProps) {
  const pathname = usePathname();
  const viewKey = pathname ?? `/projects/${projectId}`;
  const users = usePresenceStore((s) => s.viewUsers.get(viewKey) ?? EMPTY_USERS);

  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const extra = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user: PresenceUser) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <div>
              <UserAvatar
                userId={user.userId}
                name={user.name}
                className="size-7 ring-2 ring-background"
                fallbackColor={user.color}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>{user.name}</TooltipContent>
        </Tooltip>
      ))}
      {extra > 0 && (
        <Avatar className="size-7 border-2 border-background">
          <AvatarFallback className="text-[10px]">+{extra}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
