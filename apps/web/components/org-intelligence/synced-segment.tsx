"use client";

import React from "react";

interface SyncedSegmentProps {
  speaker: string;
  speakerName?: string;
  text: string;
  startMs: number;
  endMs: number;
  isActive: boolean;
  onClick: () => void;
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const SyncedSegment = React.memo(function SyncedSegment({
  speaker,
  speakerName,
  text,
  startMs,
  endMs,
  isActive,
  onClick,
}: SyncedSegmentProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-md px-3 py-2.5 text-left transition-colors ${
        isActive
          ? "border-l-2 border-primary bg-primary/5"
          : "border-l-2 border-transparent hover:bg-muted/50"
      }`}
    >
      <div className="mb-1 flex items-center gap-2">
        <span className="text-xs font-semibold text-primary">
          {speakerName ?? speaker}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {formatMs(startMs)}
          {endMs > startMs && ` - ${formatMs(endMs)}`}
        </span>
      </div>
      <p className={`text-sm leading-relaxed ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
        {text}
      </p>
    </button>
  );
});
