"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { TENANT_HEADER } from "@zeru/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/org-intelligence/status-badge";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface Interview {
  id: string;
  title: string | null;
  date: string | null;
  status: string;
  audioUrl: string | null;
  audioFilename: string | null;
  transcriptionJson: TranscriptionSegment[] | null;
  speakers: Speaker[] | null;
  projectId: string;
  createdAt: string;
  errorMessage: string | null;
}

interface Speaker {
  id: string;
  name: string;
  role?: string;
}

interface TranscriptionSegment {
  speaker: string;
  text: string;
  start?: number;
  end?: number;
}

interface ProcessingStatus {
  status: string;
  step?: string;
  errorMessage?: string;
}

const pipelineSteps = ["UPLOADED", "TRANSCRIBING", "EXTRACTING", "COMPLETED"];
const pipelineStepLabels: Record<string, string> = {
  UPLOADED: "Subido",
  TRANSCRIBING: "Transcribiendo",
  EXTRACTING: "Extrayendo",
  COMPLETED: "Completado",
};

const speakerColors = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-purple-100 text-purple-800",
  "bg-orange-100 text-orange-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
  "bg-indigo-100 text-indigo-800",
  "bg-rose-100 text-rose-800",
];

function getSpeakerColor(speaker: string, speakerMap: Map<string, number>) {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  const index = speakerMap.get(speaker)!;
  return speakerColors[index % speakerColors.length];
}

function formatTimestamp(seconds: number | undefined) {
  if (seconds == null) return null;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string; interviewId: string }>;
}) {
  const { id, interviewId } = React.use(params);
  const router = useRouter();

  const [interview, setInterview] = useState<Interview | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] =
    useState<ProcessingStatus | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInterview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Interview>(
        `/org-intelligence/interviews/${interviewId}`,
      );
      setInterview(res);
      if (
        res.status === "TRANSCRIBING" ||
        res.status === "EXTRACTING"
      ) {
        startPolling();
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollingRef.current = setInterval(async () => {
      try {
        const status = await api.get<ProcessingStatus>(
          `/org-intelligence/interviews/${interviewId}/status`,
        );
        setProcessingStatus(status);
        if (
          status.status === "COMPLETED" ||
          status.status === "FAILED"
        ) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          // Re-fetch interview to get latest data
          const res = await api.get<Interview>(
            `/org-intelligence/interviews/${interviewId}`,
          );
          setInterview(res);
        }
      } catch {
        // silently fail
      }
    }, 3000);
  }, [interviewId]);

  useEffect(() => {
    fetchInterview();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [fetchInterview]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const tenantId =
        typeof window !== "undefined"
          ? localStorage.getItem("tenantId")
          : null;
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      const headers: Record<string, string> = {};
      if (tenantId) headers[TENANT_HEADER] = tenantId;
      if (token) headers["Authorization"] = `Bearer ${token}`;

      // Use XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(
          "POST",
          `${API_BASE}/org-intelligence/interviews/${interviewId}/upload-audio`,
        );
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));

        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error("Upload failed"));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Upload failed")));
        xhr.send(formData);
      });

      await fetchInterview();
    } catch {
      // silently fail
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleProcess = async () => {
    try {
      setProcessing(true);
      await api.post(
        `/org-intelligence/interviews/${interviewId}/process`,
        {},
      );
      setProcessingStatus({ status: "TRANSCRIBING", step: "TRANSCRIBING" });
      startPolling();
      await fetchInterview();
    } catch {
      // silently fail
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!interview) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Entrevista no encontrada.</p>
        <Button
          variant="outline"
          onClick={() => router.push(`/org-intelligence/projects/${id}`)}
        >
          Volver al proyecto
        </Button>
      </div>
    );
  }

  const currentStatus = processingStatus?.status ?? interview.status;
  const currentStepIndex = pipelineSteps.indexOf(currentStatus);
  const showUpload =
    interview.status === "PENDING" && !interview.audioUrl;
  const showProcess =
    (interview.status === "UPLOADED" ||
      (interview.audioUrl && interview.status === "PENDING")) &&
    currentStatus !== "TRANSCRIBING" &&
    currentStatus !== "EXTRACTING";
  const showPipeline =
    currentStatus === "UPLOADED" ||
    currentStatus === "TRANSCRIBING" ||
    currentStatus === "EXTRACTING" ||
    currentStatus === "COMPLETED" ||
    currentStatus === "FAILED";
  const showTranscription =
    (currentStatus === "COMPLETED" || currentStatus === "EXTRACTING") &&
    interview.transcriptionJson;

  const speakerMap = new Map<string, number>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {interview.title ?? "Entrevista sin titulo"}
            </h1>
            <StatusBadge type="processing" value={currentStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(interview.date ?? interview.createdAt)}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/org-intelligence/projects/${id}`)}
        >
          Volver al proyecto
        </Button>
      </div>

      {/* Section 1: Audio Upload */}
      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Subir Audio</CardTitle>
            <CardDescription>
              Arrastra un archivo de audio o haz clic para seleccionar.
              Formatos: MP3, WAV, M4A, OGG, WebM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="space-y-2 text-center">
                  <p className="text-sm font-medium">
                    Subiendo... {uploadProgress}%
                  </p>
                  <div className="mx-auto h-2 w-48 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-center">
                  <p className="text-sm font-medium">
                    Arrastra tu archivo de audio aqui
                  </p>
                  <p className="text-xs text-muted-foreground">
                    o haz clic para seleccionar
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.wav,.m4a,.ogg,.webm,audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Audio uploaded - show filename and process button */}
      {showProcess && interview.audioFilename && (
        <Card>
          <CardHeader>
            <CardTitle>Audio Subido</CardTitle>
            <CardDescription>{interview.audioFilename}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? "Iniciando..." : "Procesar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Section 2: Processing Status */}
      {showPipeline && (
        <Card>
          <CardHeader>
            <CardTitle>Estado del Procesamiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {pipelineSteps.map((step, i) => {
                const stepIndex = pipelineSteps.indexOf(step);
                const isCompleted = stepIndex < currentStepIndex;
                const isCurrent = stepIndex === currentStepIndex;
                const isFailed =
                  currentStatus === "FAILED" && isCurrent;

                return (
                  <React.Fragment key={step}>
                    {i > 0 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          isCompleted
                            ? "bg-green-500"
                            : "bg-muted-foreground/20"
                        }`}
                      />
                    )}
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                          isFailed
                            ? "bg-red-100 text-red-800"
                            : isCompleted
                              ? "bg-green-100 text-green-800"
                              : isCurrent
                                ? "bg-blue-100 text-blue-800"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isFailed
                          ? "!"
                          : isCompleted
                            ? "\u2713"
                            : i + 1}
                      </div>
                      <span
                        className={`text-[10px] ${
                          isCurrent || isCompleted
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                      >
                        {pipelineStepLabels[step]}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            {currentStatus === "FAILED" && (
              <p className="mt-4 text-xs text-red-600">
                Error:{" "}
                {processingStatus?.errorMessage ??
                  interview.errorMessage ??
                  "Error desconocido"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Section 3: Transcription */}
      {showTranscription && interview.transcriptionJson && (
        <Card>
          <CardHeader>
            <CardTitle>Transcripcion</CardTitle>
            <CardDescription>
              {interview.transcriptionJson.length} segmentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
              {interview.transcriptionJson.map(
                (segment: TranscriptionSegment, i: number) => (
                  <div key={i} className="flex gap-3">
                    <div className="shrink-0 pt-0.5">
                      <Badge
                        variant="outline"
                        className={getSpeakerColor(
                          segment.speaker,
                          speakerMap,
                        )}
                      >
                        {segment.speaker}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed">
                        {segment.text}
                      </p>
                      {segment.start != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimestamp(segment.start)}
                          {segment.end != null &&
                            ` - ${formatTimestamp(segment.end)}`}
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
