"use client";

import { useState, useEffect, useRef } from "react";
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
 * Reacts to avatarUrl changes (e.g., null → URL when API responds).
 */
export function UserAvatar({ name, avatarUrl, className, fallbackClassName, fallbackColor }: UserAvatarProps) {
  const src = avatarUrl || null;
  const prevSrc = useRef(src);

  const [imgStatus, setImgStatus] = useState<"loading" | "loaded" | "error">(() => {
    if (!src) return "error";
    if (typeof window !== "undefined") {
      const img = new Image();
      img.src = src;
      if (img.complete && img.naturalWidth > 0) return "loaded";
    }
    return "loading";
  });

  // Reset status when avatarUrl changes (e.g., null → URL)
  useEffect(() => {
    if (src !== prevSrc.current) {
      prevSrc.current = src;
      if (!src) {
        setImgStatus("error");
      } else {
        // Check cache synchronously
        const img = new Image();
        img.src = src;
        setImgStatus(img.complete && img.naturalWidth > 0 ? "loaded" : "loading");
      }
    }
  }, [src]);

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
