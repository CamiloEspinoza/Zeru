"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePresenceStore } from "@/stores/presence-store";
import type { PresenceUser } from "@zeru/shared";
import { usePathname } from "next/navigation";

interface ProjectPresenceAvatarsProps {
  projectId: string;
  max?: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function ProjectPresenceAvatars({ projectId, max = 4 }: ProjectPresenceAvatarsProps) {
  const pathname = usePathname();
  const users = usePresenceStore((s) => s.viewUsers.get(pathname ?? `/projects/${projectId}`) ?? []);

  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const extra = users.length - max;

  return (
    <div className="flex items-center -space-x-1.5">
      {visible.map((user: PresenceUser) => (
        <Tooltip key={user.userId}>
          <TooltipTrigger asChild>
            <Avatar className={cn("size-7 border-2 border-background")}>
              <AvatarFallback
                className="text-[10px] font-medium text-white"
                style={{ backgroundColor: user.color }}
              >
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
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
