"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
  /** CSS color for the fallback background (e.g. presence color). Overrides bg-muted. */
  fallbackColor?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/**
 * UserAvatar -- renders a user's avatar image from the server-provided avatarUrl.
 * If avatarUrl is falsy, renders initials only (zero HTTP requests).
 */
export function UserAvatar({ name, avatarUrl, className, fallbackClassName, fallbackColor }: UserAvatarProps) {
  const src = avatarUrl || null;

  // Check synchronously if image is cached (before first paint)
  const isCached = typeof window !== "undefined" && src
    ? (() => { const img = new Image(); img.src = src; return img.complete && img.naturalWidth > 0; })()
    : false;

  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">(
    !src ? "error" : isCached ? "loaded" : "loading",
  );

  const initials = getInitials(name);

  return (
    <div
      className={cn(
        "relative flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
        className,
      )}
    >
      {src && imgStatus !== "error" && (
        <img
          src={src}
          alt={name}
          className="absolute inset-0 size-full rounded-full object-cover"
          loading="eager"
          decoding="sync"
          onLoad={() => setImgStatus("loaded")}
          onError={() => setImgStatus("error")}
        />
      )}
      {imgStatus !== "loaded" && (
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full text-xs font-medium",
            !fallbackColor && "bg-muted text-muted-foreground",
            fallbackColor && "text-white",
            fallbackClassName,
          )}
          style={fallbackColor ? { backgroundColor: fallbackColor } : undefined}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
