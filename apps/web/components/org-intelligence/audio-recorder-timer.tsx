"use client";

interface AudioRecorderTimerProps {
  duration: number;
  status: string;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

export function AudioRecorderTimer({ duration, status }: AudioRecorderTimerProps) {
  return (
    <div className="flex items-center gap-2">
      {status === "recording" && (
        <span className="size-2 rounded-full bg-red-500 animate-pulse" />
      )}
      <span className="font-mono text-sm tabular-nums">{formatDuration(duration)}</span>
    </div>
  );
}
