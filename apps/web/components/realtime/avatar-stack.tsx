"use client";

import { usePresenceStore } from "@/stores/presence-store";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { PresenceUser } from "@zeru/shared";

const MAX_VISIBLE = 4;

function PresenceAvatar({ user, size = 32 }: { user: PresenceUser; size?: number }) {
  const sizeClass = size <= 24 ? "size-6" : "size-8";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatar}
              className={`${sizeClass} ring-2 ring-background`}
              fallbackColor={user.color}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>{user.name}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const EMPTY_USERS: PresenceUser[] = [];

export function AvatarStack({ viewPath }: { viewPath: string }) {
  const viewUsers = usePresenceStore((s) => s.viewUsers.get(viewPath) ?? EMPTY_USERS);

  if (viewUsers.length === 0) return null;

  const visible = viewUsers.slice(0, MAX_VISIBLE);
  const overflow = viewUsers.length - MAX_VISIBLE;

  return (
    <div className="flex items-center -space-x-2">
      {visible.map((user) => (
        <PresenceAvatar key={user.userId} user={user} />
      ))}
      {overflow > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <div className="rounded-full flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium ring-2 ring-background cursor-pointer w-8 h-8">
              +{overflow}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2">
            <div className="space-y-2">
              {viewUsers.slice(MAX_VISIBLE).map((user) => (
                <div key={user.userId} className="flex items-center gap-2 text-sm">
                  <PresenceAvatar user={user} size={24} />
                  <span>{user.name}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
