interface TimestampBadgeProps {
  startMs: number;
  endMs: number;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function TimestampBadge({ startMs, endMs }: TimestampBadgeProps) {
  return (
    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
      {formatMs(startMs)} – {formatMs(endMs)}
    </span>
  );
}
