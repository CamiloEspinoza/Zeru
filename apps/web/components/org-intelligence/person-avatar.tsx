"use client";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface PersonAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PersonAvatar({
  name,
  avatarUrl,
  size = "md",
  className,
}: PersonAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeMap = {
    sm: "sm" as const,
    md: "default" as const,
    lg: "lg" as const,
  };

  const textSizes = {
    sm: "text-[10px]",
    md: "text-xs",
    lg: "text-sm",
  };

  return (
    <Avatar size={sizeMap[size]} className={cn(className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
      <AvatarFallback className={textSizes[size]}>{initials}</AvatarFallback>
    </Avatar>
  );
}
