"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

interface SpeakerAvatarChipProps {
  name: string;
  avatarUrl?: string | null;
  isInterviewer?: boolean;
  className?: string;
}

export function SpeakerAvatarChip({
  name,
  avatarUrl,
  isInterviewer = false,
  className,
}: SpeakerAvatarChipProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "group/chip relative flex h-7 items-center rounded-full border transition-all duration-200 ease-out",
        isInterviewer
          ? "border-primary/30 bg-primary/10"
          : "border-border bg-muted/50",
        className,
      )}
    >
      {/* Avatar circle */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium",
          isInterviewer
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={name}
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>

      {/* Name — hidden by default, expands on hover */}
      <span
        className={cn(
          "max-w-0 overflow-hidden whitespace-nowrap text-[11px] font-medium transition-all duration-200 ease-out group-hover/chip:max-w-[120px] group-hover/chip:px-2",
          isInterviewer ? "text-primary" : "text-foreground",
        )}
      >
        {name}
      </span>
    </div>
  );
}
