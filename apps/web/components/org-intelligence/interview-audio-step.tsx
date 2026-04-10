"use client";

import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { TENANT_HEADER } from "@zeru/shared";
import { useAudioRecorder } from "./use-audio-recorder";
import { AudioRecorderControls } from "./audio-recorder-controls";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface AudioTrack {
  id: string;
  trackOrder: number;
  originalName: string | null;
  sourceLabel: string | null;
}

const SOURCE_OPTIONS = ["iPhone", "MacBook", "Grabadora externa", "Otro"];

function detectSource(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("iphone") || lower.includes("ios")) return "iPhone";
  if (lower.includes("mac") || lower.includes("macbook")) return "MacBook";
  return "Otro";
}

function xhrUpload(
  iId: string,
  blob: Blob,
  name: string,
  trackOrder?: number,
  sourceLabel?: string,
  onProgress?: (pct: number) => void,
) {
  const t = typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
  const tk = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const fd = new FormData();
  fd.append("file", blob, name);
  const qs = trackOrder
    ? `?trackOrder=${trackOrder}&sourceLabel=${encodeURIComponent(sourceLabel ?? "")}`
    : "";
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open("POST", `${API_BASE}/org-intelligence/interviews/${iId}/upload-audio${qs}`);
    if (t) x.setRequestHeader(TENANT_HEADER, t);
    if (tk) x.setRequestHeader("Authorization", `Bearer ${tk}`);
    if (onProgress) {
      x.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }
    x.addEventListener("load", () => (x.status < 300 ? res() : rej()));
    x.addEventListener("error", rej);
    x.send(fd);
  });
}

interface Props {
  interviewId: string;
  hasAudio: boolean;
  tracks?: AudioTrack[];
  onAudioUploaded: () => void;
}

export function InterviewAudioStep({ interviewId: iId, hasAudio, tracks = [], onAudioUploaded }: Props) {
  const { state, start, pause, resume, stop, reset } = useAudioRecorder();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showUpload, setShowUpload] = useState(!hasAudio);
  const ref1 = useRef<HTMLInputElement>(null);
  const ref2 = useRef<HTMLInputElement>(null);

  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [source1, setSource1] = useState("iPhone");
  const [source2, setSource2] = useState("MacBook");

  const handleUpload = async () => {
    if (!file1 && !file2) return;
    setUploading(true);
    setProgress(0);
    try {
      if (file1) {
        await xhrUpload(iId, file1, file1.name, 1, source1, setProgress);
      }
      if (file2) {
        setProgress(0);
        await xhrUpload(iId, file2, file2.name, 2, source2, setProgress);
      }
      toast.success(file2 ? "2 audios subidos." : "Audio subido.");
      setFile1(null);
      setFile2(null);
      setShowUpload(false);
      onAudioUploaded();
    } catch {
      toast.error("Error al subir audio.");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const doRecordUpload = async (blob: Blob, name: string) => {
    setUploading(true);
    try {
      await xhrUpload(iId, blob, name, 1, "Grabación browser");
      toast.success("Audio subido.");
      reset();
      setShowUpload(false);
      onAudioUploaded();
    } catch {
      toast.error("No se pudo subir el audio.");
    } finally {
      setUploading(false);
    }
  };

  if (hasAudio && !showUpload) {
    return (
      <div className="space-y-2">
        {tracks.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {tracks.map((t) => (
              <span key={t.id} className="text-xs text-muted-foreground">
                Track {t.trackOrder}: {t.originalName ?? "audio"} ({t.sourceLabel ?? "Sin fuente"})
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {tracks.length > 1 ? "Reemplazar audios" : "Reemplazar audio"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {hasAudio && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Al subir nuevo audio se reemplazará el actual y se deberá reprocesar la entrevista.
          </p>
          <button
            type="button"
            onClick={() => setShowUpload(false)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Grabar audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <AudioRecorderControls
              status={state.status}
              onStart={() => start()}
              onPause={pause}
              onResume={resume}
              onStop={stop}
              onReset={reset}
              disabled={uploading}
            />
            {state.status === "recording" && (
              <p className="text-xs text-muted-foreground">{state.duration}s grabando...</p>
            )}
            {state.status === "stopped" && state.audioBlob && (
              <button
                type="button"
                onClick={() => doRecordUpload(state.audioBlob!, "recording.webm")}
                disabled={uploading}
                className="text-sm text-primary underline disabled:opacity-50"
              >
                {uploading ? "Subiendo..." : "Subir grabación"}
              </button>
            )}
            {state.error && <p className="text-xs text-red-500">{state.error}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subir archivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Track 1 */}
            {file1 ? (
              <div className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                <span className="truncate max-w-[140px]">{file1.name}</span>
                <div className="flex items-center gap-2">
                  <Select value={source1} onValueChange={setSource1}>
                    <SelectTrigger className="h-6 w-24 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => setFile1(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => ref1.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref1.current?.click(); }}
                className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 text-xs text-muted-foreground transition-colors hover:border-muted-foreground/50"
              >
                Track 1 — clic para seleccionar
              </div>
            )}
            <input
              ref={ref1}
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile1(f); setSource1(detectSource(f.name)); }
                if (ref1.current) ref1.current.value = "";
              }}
            />

            {/* Track 2 (optional) */}
            {file2 ? (
              <div className="flex items-center justify-between rounded border px-2 py-1.5 text-xs">
                <span className="truncate max-w-[140px]">{file2.name}</span>
                <div className="flex items-center gap-2">
                  <Select value={source2} onValueChange={setSource2}>
                    <SelectTrigger className="h-6 w-24 text-[10px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button type="button" onClick={() => setFile2(null)} className="text-muted-foreground hover:text-foreground">✕</button>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => ref2.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ref2.current?.click(); }}
                className="flex min-h-[48px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 text-xs text-muted-foreground/60 transition-colors hover:border-muted-foreground/40"
              >
                Track 2 (opcional) — mejora la transcripción
              </div>
            )}
            <input
              ref={ref2}
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setFile2(f); setSource2(detectSource(f.name)); }
                if (ref2.current) ref2.current.value = "";
              }}
            />

            {(file1 || file2) && (
              <Button
                onClick={handleUpload}
                disabled={uploading || (!file1 && !file2)}
                size="sm"
                className="w-full"
              >
                {uploading
                  ? `Subiendo... ${progress}%`
                  : `Subir ${file2 ? "2 archivos" : "archivo"}`}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
