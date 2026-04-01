"use client";

import { useEffect, useRef } from "react";
import { useAudioRecorder } from "./use-audio-recorder";
import { AudioRecorderControls } from "./audio-recorder-controls";
import { AudioRecorderTimer } from "./audio-recorder-timer";
import { AudioRecorderVisualizer } from "./audio-recorder-visualizer";
import { Button } from "@/components/ui/button";

interface AudioRecorderProps { onRecordingComplete: (blob: Blob) => void; }

export function AudioRecorder({ onRecordingComplete }: AudioRecorderProps) {
  const { state, start, pause, resume, stop, reset, selectDevice, refreshDevices } = useAudioRecorder();
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const isStopped = state.status === "stopped";

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 w-full max-w-lg">
      {!isStopped && (
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground whitespace-nowrap">Microfono:</label>
          <select
            className="flex-1 h-7 rounded-md border border-input bg-input/20 px-2 text-xs outline-none"
            value={state.selectedDeviceId ?? ""}
            onChange={(e) => selectDevice(e.target.value)}
          >
            {state.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>{d.label || `Microfono ${d.deviceId.slice(0, 8)}`}</option>
            ))}
          </select>
        </div>
      )}

      {!isStopped && <AudioRecorderVisualizer level={state.level} status={state.status} />}
      {!isStopped && <div className="flex justify-center"><AudioRecorderTimer duration={state.duration} status={state.status} /></div>}
      {isStopped && state.audioUrl && <audio ref={audioRef} src={state.audioUrl} controls className="w-full" />}
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}

      <div className="flex items-center justify-between gap-2">
        <AudioRecorderControls status={state.status} onStart={() => start()} onPause={pause} onResume={resume} onStop={stop} onReset={reset} />
        {isStopped && state.audioBlob && (
          <Button onClick={() => onRecordingComplete(state.audioBlob!)}>Usar grabacion</Button>
        )}
      </div>
    </div>
  );
}
