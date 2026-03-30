"use client";

import { Button } from "@/components/ui/button";

type Status = "idle" | "recording" | "paused" | "stopped";
interface Props { status: Status; onStart: () => void; onPause: () => void; onResume: () => void; onStop: () => void; onReset: () => void; disabled?: boolean; }

export function AudioRecorderControls({ status, onStart, onPause, onResume, onStop, onReset, disabled }: Props) {
  if (status === "idle") return (
    <Button onClick={onStart} disabled={disabled} className="bg-red-600 text-white hover:bg-red-700">
      Grabar
    </Button>
  );

  if (status === "recording") return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onPause} disabled={disabled}>Pausar</Button>
      <Button variant="outline" onClick={onStop} disabled={disabled}>Detener</Button>
    </div>
  );

  if (status === "paused") return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onResume} disabled={disabled}>Reanudar</Button>
      <Button variant="outline" onClick={onStop} disabled={disabled}>Detener</Button>
    </div>
  );

  return (
    <Button variant="outline" onClick={onReset} disabled={disabled}>Nueva grabacion</Button>
  );
}
