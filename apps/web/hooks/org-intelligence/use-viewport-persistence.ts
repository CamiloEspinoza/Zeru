"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { Viewport } from "@xyflow/react";

/* ---------- Storage key ---------- */

function getStorageKey(): string {
  const tenantId =
    typeof localStorage !== "undefined"
      ? (localStorage.getItem("tenantId") ?? "default")
      : "default";
  return `orgchart-viewport-${tenantId}`;
}

/* ---------- Hook ---------- */

export function useViewportPersistence() {
  const [savedViewport] = useState<Viewport | null>(() => {
    if (typeof localStorage === "undefined") return null;
    try {
      const raw = localStorage.getItem(getStorageKey());
      return raw ? (JSON.parse(raw) as Viewport) : null;
    } catch {
      return null;
    }
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMoveEnd = useCallback((_event: unknown, viewport: Viewport) => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem(getStorageKey(), JSON.stringify(viewport));
      } catch {
        // Ignore storage errors
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return { savedViewport, onMoveEnd };
}
