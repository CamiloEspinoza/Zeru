"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface PlayerControlsProps {
  playing: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onPlaybackRateChange: (rate: number) => void;
}

const RATES = [0.5, 1, 1.5, 2] as const;

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PlayerControls({
  playing,
  currentTimeMs,
  durationMs,
  playbackRate,
  onTogglePlay,
  onSeek,
  onPlaybackRateChange,
}: PlayerControlsProps) {
  const max = durationMs > 0 ? durationMs : 1;

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onTogglePlay}
          aria-label={playing ? "Pausar" : "Reproducir"}
        >
          {playing ? (
            <span className="text-xs font-bold">II</span>
          ) : (
            <span className="text-xs">&#9654;</span>
          )}
        </Button>

        <input
          type="range"
          min={0}
          max={max}
          value={currentTimeMs}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="flex-1 cursor-pointer accent-primary"
          aria-label="Posicion de reproduccion"
        />

        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {formatMs(currentTimeMs)} / {formatMs(durationMs)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">Velocidad:</span>
        {RATES.map((rate) => (
          <button
            key={rate}
            type="button"
            onClick={() => onPlaybackRateChange(rate)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              playbackRate === rate
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {rate}x
          </button>
        ))}
      </div>
    </div>
  );
}
