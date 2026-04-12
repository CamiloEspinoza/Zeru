"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId: string | null | undefined;
  name: string;
  /** Set to false to skip the image request entirely (user has no avatar). Default: true */
  hasAvatar?: boolean;
  className?: string;
  fallbackClassName?: string;
  /** CSS color for the fallback background (e.g. presence color). Overrides bg-muted. */
  fallbackColor?: string;
}

/**
 * Module-level cache of userIds whose avatar request returned a 404.
 * Prevents repeated failed requests until page reload.
 */
const failedUserIds = new Set<string>();

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

/**
 * UserAvatar — renders a user's avatar image from the /api/avatars/:userId
 * proxy endpoint. Uses a native <img> to avoid fallback flash.
 */
export function UserAvatar({ userId, name, hasAvatar = true, className, fallbackClassName, fallbackColor }: UserAvatarProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const shouldLoad = userId && hasAvatar !== false && !failedUserIds.has(userId);
  const src = shouldLoad ? `${API_BASE}/avatars/${userId}?s=96` : null;

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
          ref={imgRef}
          src={src}
          alt={name}
          className="absolute inset-0 size-full rounded-full object-cover"
          loading="eager"
          decoding="sync"
          onLoad={() => setImgStatus("loaded")}
          onError={() => {
            if (userId) failedUserIds.add(userId);
            setImgStatus("error");
          }}
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
