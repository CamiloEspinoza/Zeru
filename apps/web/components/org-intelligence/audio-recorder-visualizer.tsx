"use client";

interface AudioRecorderVisualizerProps {
  level: number;
  status: string;
}

function levelColor(level: number): string {
  if (level < 0.4) return "bg-green-500";
  if (level < 0.7) return "bg-yellow-400";
  return "bg-red-500";
}

export function AudioRecorderVisualizer({ level, status }: AudioRecorderVisualizerProps) {
  const isActive = status === "recording";

  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-75 ${isActive ? levelColor(level) : "bg-muted-foreground/30"}`}
        style={{ width: `${isActive ? Math.max(level * 100, 2) : 0}%` }}
      />
    </div>
  );
}
