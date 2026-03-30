"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { TENANT_HEADER } from "@zeru/shared";
import { useAudioRecorder } from "./use-audio-recorder";
import { AudioRecorderControls } from "./audio-recorder-controls";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

function xhrUpload(iId: string, blob: Blob, name: string) {
  const t = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
  const tk = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const fd = new FormData(); fd.append("file", blob, name);
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("POST", `${API_BASE}/org-intelligence/interviews/${iId}/upload-audio`);
    if (t) x.setRequestHeader(TENANT_HEADER, t);
    if (tk) x.setRequestHeader("Authorization", `Bearer ${tk}`);
    x.addEventListener("load", () => x.status < 300 ? res() : rej()); x.addEventListener("error", rej); x.send(fd);
  });
}

interface Props { interviewId: string; hasAudio: boolean; onAudioUploaded: () => void }

export function InterviewAudioStep({ interviewId: iId, hasAudio, onAudioUploaded }: Props) {
  const { state, start, pause, resume, stop, reset } = useAudioRecorder();
  const [up, setUp] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const doUpload = async (b: Blob, n: string) => {
    setUp(true);
    try { await xhrUpload(iId, b, n); toast.success("Audio subido."); onAudioUploaded(); reset(); }
    catch { toast.error("No se pudo subir el audio."); } finally { setUp(false); }
  };

  if (hasAudio) return null;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Grabar audio</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <AudioRecorderControls status={state.status} onStart={() => start()} onPause={pause} onResume={resume} onStop={stop} onReset={reset} disabled={up} />
          {state.status === "recording" && <p className="text-xs text-muted-foreground">{state.duration}s grabando...</p>}
          {state.status === "stopped" && state.audioBlob && (
            <button type="button" onClick={() => doUpload(state.audioBlob!, "recording.webm")} disabled={up} className="text-sm text-primary underline disabled:opacity-50">
              {up ? "Subiendo..." : "Subir grabacion"}
            </button>
          )}
          {state.error && <p className="text-xs text-red-500">{state.error}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Subir archivo</CardTitle></CardHeader>
        <CardContent>
          <div role="button" tabIndex={0} onClick={() => ref.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref.current?.click(); }}
            className="flex min-h-[80px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/50">
            {up ? "Subiendo..." : "Clic o arrastra un archivo de audio"}
          </div>
          <input ref={ref} type="file" accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) doUpload(f, f.name); if (ref.current) ref.current.value = ""; }} />
        </CardContent>
      </Card>
    </div>
  );
}
