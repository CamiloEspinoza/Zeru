"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  userId: string | null | undefined;
  name: string;
  className?: string;
  fallbackClassName?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

/**
 * UserAvatar — renders a user's avatar image from the /api/avatars/:userId
 * proxy endpoint. Uses a native <img> instead of Radix Avatar to avoid the
 * fallback flash: if the image is in browser cache, it renders synchronously.
 */
export function UserAvatar({ userId, name, className, fallbackClassName }: UserAvatarProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const src = userId ? `/api/avatars/${userId}` : null;

  // Check synchronously if image is cached (before first paint)
  const isCached = typeof window !== "undefined" && src
    ? (() => { const img = new Image(); img.src = src; return img.complete && img.naturalWidth > 0; })()
    : false;

  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">(
    !userId ? "error" : isCached ? "loaded" : "loading",
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
          onError={() => setImgStatus("error")}
        />
      )}
      {imgStatus !== "loaded" && (
        <span
          className={cn(
            "flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium",
            fallbackClassName,
          )}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
