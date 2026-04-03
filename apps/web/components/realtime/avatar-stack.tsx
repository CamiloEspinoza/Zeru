"use client";

import Image from "next/image";
import { usePresenceStore } from "@/stores/presence-store";
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

function UserAvatar({ user, size = 32 }: { user: PresenceUser; size?: number }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-background"
            style={{
              width: size,
              height: size,
              backgroundColor: user.color,
            }}
          >
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name}
                width={size}
                height={size}
                className="rounded-full object-cover"
              />
            ) : (
              initials
            )}
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
        <UserAvatar key={user.userId} user={user} />
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
                  <UserAvatar user={user} size={24} />
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
