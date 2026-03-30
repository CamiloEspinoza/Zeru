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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProgressCelebration } from "@/components/org-intelligence/progress-celebration";
import { useFirstVisit } from "@/hooks/use-first-visit";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon } from "@hugeicons/core-free-icons";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface Interview {
  id: string;
  title: string | null;
  interviewDate: string | null;
  processingStatus: string;
  processingError: string | null;
  audioS3Key: string | null;
  audioMimeType: string | null;
  transcriptionText: string | null;
  transcriptionJson: Record<string, unknown> | null;
  transcriptionStatus: string;
  speakers: Speaker[];
  projectId: string;
  createdAt: string;
}

interface Speaker {
  id: string;
  speakerLabel: string;
  name: string | null;
  role: string | null;
  department: string | null;
  isInterviewer: boolean;
}

interface SpeakerFormData {
  speakerLabel: string;
  name: string;
  role: string;
  department: string;
  isInterviewer: boolean;
}

interface TranscriptionSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speakerConfidence?: number;
}

interface ProcessingStatus {
  id: string;
  processingStatus: string;
  processingError: string | null;
  transcriptionStatus: string;
}

const pipelineSteps = [
  "UPLOADED",
  "TRANSCRIBING",
  "POST_PROCESSING",
  "EXTRACTING",
  "RESOLVING_COREFERENCES",
  "SUMMARIZING",
  "CHUNKING",
  "EMBEDDING",
  "COMPLETED",
];
const pipelineStepLabels: Record<string, string> = {
  UPLOADED: "Subido",
  TRANSCRIBING: "Transcribiendo",
  POST_PROCESSING: "Post-procesando",
  EXTRACTING: "Extrayendo",
  RESOLVING_COREFERENCES: "Reconciliando",
  SUMMARIZING: "Resumiendo",
  CHUNKING: "Fragmentando",
  EMBEDDING: "Indexando",
  COMPLETED: "Completado",
};

const pipelineStepDescriptions: Record<string, string> = {
  UPLOADED: "Audio recibido correctamente",
  TRANSCRIBING: "Convirtiendo audio a texto con identificación de hablantes (Deepgram Nova-3)",
  POST_PROCESSING: "Limpiando y estructurando la transcripción",
  EXTRACTING: "Extrayendo roles, procesos, problemas y dependencias con IA (5 pasadas de análisis)",
  RESOLVING_COREFERENCES: "Reconciliando entidades duplicadas y resolviendo co-referencias entre entrevistas",
  SUMMARIZING: "Generando resúmenes de cada segmento de la entrevista",
  CHUNKING: "Dividiendo la transcripción en fragmentos para búsqueda semántica",
  EMBEDDING: "Generando embeddings vectoriales para búsqueda semántica",
  COMPLETED: "Procesamiento finalizado. Los resultados están disponibles en las pestañas de Análisis y Diagnóstico del proyecto.",
};

const speakerColors = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
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

const emptySpeakerForm: SpeakerFormData = {
  speakerLabel: "",
  name: "",
  role: "",
  department: "",
  isInterviewer: false,
};

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

  // Speaker management state
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [speakerForm, setSpeakerForm] = useState<SpeakerFormData>(emptySpeakerForm);
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState<number | null>(null);
  const [savingSpeakers, setSavingSpeakers] = useState(false);

  // Edit interview state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", interviewDate: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete interview state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reprocess state
  const [reprocessDialogOpen, setReprocessDialogOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);

  // Success banner for first completed processing
  const { isFirstVisit: showSuccessBanner, markVisited: dismissSuccessBanner } = useFirstVisit(`interview_completed_${interviewId}`);

  const fetchInterview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Interview>(
        `/org-intelligence/interviews/${interviewId}`,
      );
      setInterview(res);
      if (
        res.processingStatus !== "PENDING" &&
        res.processingStatus !== "UPLOADED" &&
        res.processingStatus !== "COMPLETED" &&
        res.processingStatus !== "FAILED"
      ) {
        startPolling();
      }
    } catch (err) {
      console.error("Error al cargar entrevista:", err);
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
          status.processingStatus === "COMPLETED" ||
          status.processingStatus === "FAILED"
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
      } catch (err) {
        console.error("Error al verificar estado:", err);
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

  const MAX_FILE_SIZE_MB = 500;
  const ALLOWED_AUDIO_TYPES = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/ogg",
    "audio/webm",
  ];
  const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".webm"];

  const handleFileUpload = async (file: File) => {
    // Validate file type
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(ext)) {
      alert(`Tipo de archivo no permitido. Usa: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    // Validate file size
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`El archivo excede el tamaño máximo de ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }

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
    } catch (err) {
      console.error("Error al subir audio:", err);
      alert("No se pudo subir el archivo de audio. Intenta nuevamente.");
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
      setProcessingStatus({ id: interviewId, processingStatus: "TRANSCRIBING", processingError: null, transcriptionStatus: "PROCESSING" });
      startPolling();
      await fetchInterview();
    } catch (err) {
      console.error("Error al iniciar procesamiento:", err);
      alert("No se pudo iniciar el procesamiento. Intenta nuevamente.");
    } finally {
      setProcessing(false);
    }
  };

  // --- Edit interview handlers ---

  const openEditDialog = () => {
    if (!interview) return;
    setEditForm({
      title: interview.title ?? "",
      interviewDate: interview.interviewDate
        ? new Date(interview.interviewDate).toISOString().split("T")[0]
        : "",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!interview) return;
    try {
      setSavingEdit(true);
      await api.patch(`/org-intelligence/interviews/${interviewId}`, {
        title: editForm.title || undefined,
        interviewDate: editForm.interviewDate
          ? new Date(editForm.interviewDate + "T12:00:00").toISOString()
          : undefined,
      });
      setEditDialogOpen(false);
      await fetchInterview();
    } catch (err) {
      console.error("Error al guardar entrevista:", err);
      alert("No se pudo guardar los cambios.");
    } finally {
      setSavingEdit(false);
    }
  };

  // --- Delete interview handler ---

  const handleDeleteInterview = async () => {
    try {
      setDeleting(true);
      await api.delete(`/org-intelligence/interviews/${interviewId}`);
      router.push(`/org-intelligence/projects/${id}`);
    } catch (err) {
      console.error("Error al eliminar entrevista:", err);
      alert("No se pudo eliminar la entrevista.");
    } finally {
      setDeleting(false);
    }
  };

  // --- Reprocess interview handler ---

  const handleReprocess = async () => {
    try {
      setReprocessing(true);
      await api.post(
        `/org-intelligence/interviews/${interviewId}/process`,
        {},
      );
      setReprocessDialogOpen(false);
      setProcessingStatus({ id: interviewId, processingStatus: "TRANSCRIBING", processingError: null, transcriptionStatus: "PROCESSING" });
      startPolling();
      await fetchInterview();
    } catch (err) {
      console.error("Error al reprocesar entrevista:", err);
      alert("No se pudo iniciar el reprocesamiento.");
    } finally {
      setReprocessing(false);
    }
  };

  // --- Speaker management handlers ---

  const openAddSpeakerDialog = () => {
    const nextIndex = interview?.speakers?.length ?? 0;
    setSpeakerForm({
      ...emptySpeakerForm,
      speakerLabel: `Speaker_${nextIndex}`,
    });
    setEditingSpeakerIndex(null);
    setSpeakerDialogOpen(true);
  };

  const openEditSpeakerDialog = (index: number) => {
    if (!interview) return;
    const speaker = interview.speakers[index];
    setSpeakerForm({
      speakerLabel: speaker.speakerLabel,
      name: speaker.name ?? "",
      role: speaker.role ?? "",
      department: speaker.department ?? "",
      isInterviewer: speaker.isInterviewer,
    });
    setEditingSpeakerIndex(index);
    setSpeakerDialogOpen(true);
  };

  const handleSaveSpeaker = async () => {
    if (!interview || !speakerForm.speakerLabel.trim()) return;
    setSavingSpeakers(true);
    try {
      const currentSpeakers = interview.speakers.map((s) => ({
        speakerLabel: s.speakerLabel,
        name: s.name ?? undefined,
        role: s.role ?? undefined,
        department: s.department ?? undefined,
        isInterviewer: s.isInterviewer,
      }));

      let updatedSpeakers;
      if (editingSpeakerIndex !== null) {
        // Edit existing
        updatedSpeakers = [...currentSpeakers];
        updatedSpeakers[editingSpeakerIndex] = {
          speakerLabel: speakerForm.speakerLabel,
          name: speakerForm.name || undefined,
          role: speakerForm.role || undefined,
          department: speakerForm.department || undefined,
          isInterviewer: speakerForm.isInterviewer,
        };
      } else {
        // Add new
        updatedSpeakers = [
          ...currentSpeakers,
          {
            speakerLabel: speakerForm.speakerLabel,
            name: speakerForm.name || undefined,
            role: speakerForm.role || undefined,
            department: speakerForm.department || undefined,
            isInterviewer: speakerForm.isInterviewer,
          },
        ];
      }

      await api.patch(
        `/org-intelligence/interviews/${interviewId}/speakers`,
        { speakers: updatedSpeakers },
      );

      await fetchInterview();
      setSpeakerDialogOpen(false);
      setSpeakerForm(emptySpeakerForm);
      setEditingSpeakerIndex(null);
    } catch (err) {
      console.error("Error al guardar participante:", err);
      alert("No se pudo guardar el participante.");
    } finally {
      setSavingSpeakers(false);
    }
  };

  const handleDeleteSpeaker = async (index: number) => {
    if (!interview) return;
    setSavingSpeakers(true);
    try {
      const updatedSpeakers = interview.speakers
        .filter((_, i) => i !== index)
        .map((s) => ({
          speakerLabel: s.speakerLabel,
          name: s.name ?? undefined,
          role: s.role ?? undefined,
          department: s.department ?? undefined,
          isInterviewer: s.isInterviewer,
        }));

      await api.patch(
        `/org-intelligence/interviews/${interviewId}/speakers`,
        { speakers: updatedSpeakers },
      );

      await fetchInterview();
    } catch (err) {
      console.error("Error al eliminar participante:", err);
      alert("No se pudo eliminar el participante.");
    } finally {
      setSavingSpeakers(false);
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

  const currentStatus = processingStatus?.processingStatus ?? interview.processingStatus;
  const currentStepIndex = pipelineSteps.indexOf(currentStatus);
  const isProcessing = pipelineSteps.indexOf(currentStatus) > 0 && currentStatus !== "COMPLETED";
  const showUpload =
    interview.processingStatus === "PENDING" && !interview.audioS3Key;
  const showProcess =
    (interview.processingStatus === "UPLOADED" ||
      (interview.audioS3Key && interview.processingStatus === "PENDING")) &&
    !isProcessing;
  const showPipeline =
    currentStatus !== "PENDING" &&
    (pipelineSteps.includes(currentStatus) || currentStatus === "FAILED");
  const showTranscription =
    (currentStatus === "COMPLETED" || pipelineSteps.indexOf(currentStatus) >= pipelineSteps.indexOf("EXTRACTING")) &&
    interview.transcriptionJson;

  const hasSpeakers = interview.speakers.length > 0;
  const speakerMap = new Map<string, number>();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {interview.title ?? "Entrevista sin título"}
            </h1>
            <StatusBadge type="processing" value={currentStatus} />
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(interview.interviewDate ?? interview.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Reprocess button for FAILED status */}
          {currentStatus === "FAILED" && (
            <Button
              variant="outline"
              onClick={() => setReprocessDialogOpen(true)}
              disabled={reprocessing}
            >
              {reprocessing ? "Reintentando..." : "Reintentar procesamiento"}
            </Button>
          )}
          {/* Reprocess button for COMPLETED status */}
          {currentStatus === "COMPLETED" && (
            <Button
              variant="outline"
              onClick={() => setReprocessDialogOpen(true)}
            >
              Reprocesar
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={openEditDialog}
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
            <span className="sr-only">Editar entrevista</span>
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            <span className="sr-only">Eliminar entrevista</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push(`/org-intelligence/projects/${id}`)}
          >
            Volver al proyecto
          </Button>
        </div>
      </div>

      {/* Section 1: Participants Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle>Participantes de la Entrevista</CardTitle>
              <HelpTooltip text="Configurar los participantes antes de procesar el audio permite que la IA identifique mejor a cada hablante y asocie correctamente roles, departamentos y perspectivas en el análisis organizacional." />
            </div>
            <Button
              size="sm"
              onClick={openAddSpeakerDialog}
              disabled={savingSpeakers}
            >
              Agregar participante
            </Button>
          </div>
          <CardDescription>
            Define quiénes participaron en la entrevista, sus cargos y áreas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasSpeakers ? (
            <div className="space-y-3">
              {interview.speakers.map((speaker, index) => (
                <div
                  key={speaker.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {(speaker.name ?? speaker.speakerLabel).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {speaker.name ?? speaker.speakerLabel}
                        </span>
                        <Badge
                          variant={speaker.isInterviewer ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {speaker.isInterviewer ? "Entrevistador" : "Entrevistado"}
                        </Badge>
                      </div>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {speaker.role && <span>{speaker.role}</span>}
                        {speaker.role && speaker.department && <span>-</span>}
                        {speaker.department && <span>{speaker.department}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditSpeakerDialog(index)}
                      disabled={savingSpeakers}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteSpeaker(index)}
                      disabled={savingSpeakers}
                    >
                      Eliminar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hay participantes configurados.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Agregar participantes mejora la precisión del análisis con IA.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={openAddSpeakerDialog}
              >
                Agregar primer participante
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Audio Upload */}
      {showUpload && (
        <Card>
          <CardHeader>
            <CardTitle>Subir Audio</CardTitle>
            <CardDescription>
              Sube el audio de la entrevista (MP3, WAV, M4A, OGG o WebM, máximo 500 MB). La grabación será transcrita automáticamente con identificación de hablantes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!hasSpeakers && (
              <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-800 dark:border-yellow-900/50 dark:bg-yellow-900/20 dark:text-yellow-200">
                Se recomienda configurar los participantes antes de subir el audio para obtener mejores resultados en el análisis.
              </div>
            )}
            <div
              role="button"
              tabIndex={0}
              aria-label="Subir archivo de audio"
              className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
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
                    Arrastra tu archivo de audio aquí
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
      {showProcess && interview.audioS3Key?.split("/").pop() && (
        <Card>
          <CardHeader>
            <CardTitle>Audio Subido</CardTitle>
            <CardDescription>{interview.audioS3Key?.split("/").pop()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Button onClick={handleProcess} disabled={processing}>
                {processing ? "Iniciando..." : "Procesar"}
              </Button>
              <HelpTooltip text="Al procesar, la IA transcribirá el audio, identificará quién habla, extraerá roles, procesos, problemas y dependencias, y generará un mapa de conocimiento organizacional. Este proceso toma entre 3 y 5 minutos." />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Processing Status */}
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
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[10px] ${
                            isCurrent || isCompleted
                              ? "font-medium text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {pipelineStepLabels[step]}
                        </span>
                        <HelpTooltip text={pipelineStepDescriptions[step]} />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
            {currentStatus === "TRANSCRIBING" && (
              <p className="mt-4 text-xs text-muted-foreground">
                Convirtiendo audio a texto. Esto suele tomar 1-2 minutos dependiendo de la duración del audio.
              </p>
            )}
            {currentStatus === "EXTRACTING" && (
              <p className="mt-4 text-xs text-muted-foreground">
                Analizando el texto para identificar personas, procesos, problemas y dependencias. Esto toma 2-3 minutos.
              </p>
            )}
            {currentStatus === "FAILED" && (
              <p className="mt-4 text-xs text-red-600">
                Error:{" "}
                {processingStatus?.processingError ??
                  interview.processingError ??
                  "Error desconocido"}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Success banner after processing completes */}
      {currentStatus === "COMPLETED" && showSuccessBanner && (
        <ProgressCelebration
          title="Entrevista procesada exitosamente"
          message="La IA extrajo conocimiento organizacional de la conversación. Revisa los resultados en las pestañas de Análisis y Diagnóstico del proyecto."
          actions={[
            { label: "Ir a Análisis", href: `/org-intelligence/projects/${id}?tab=analysis` },
            { label: "Ir a Diagnóstico", href: `/org-intelligence/projects/${id}?tab=diagnosis` },
          ]}
          onDismiss={dismissSuccessBanner}
        />
      )}

      {/* Section 4: Transcription */}
      {showTranscription && interview.transcriptionJson && (
        <Card>
          <CardHeader>
            <CardTitle>Transcripción</CardTitle>
            <CardDescription>
              Transcripción con identificación de hablantes. Cada color representa un participante diferente de la entrevista. {((interview.transcriptionJson as Record<string, unknown>).segments as TranscriptionSegment[] | undefined)?.length ?? 0} segmentos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
              {(((interview.transcriptionJson as Record<string, unknown>).segments as TranscriptionSegment[]) ?? []).map(
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
                      {segment.startMs != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimestamp(segment.startMs / 1000)}
                          {segment.endMs != null &&
                            ` - ${formatTimestamp(segment.endMs / 1000)}`}
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

      {/* Edit Interview Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Entrevista</DialogTitle>
            <DialogDescription>
              Modifica el título y la fecha de la entrevista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-interview-title">Título</Label>
              <Input
                id="edit-interview-title"
                placeholder="Título de la entrevista"
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-interview-date">Fecha de la entrevista</Label>
              <Input
                id="edit-interview-date"
                type="date"
                value={editForm.interviewDate}
                onChange={(e) =>
                  setEditForm({ ...editForm, interviewDate: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialogOpen(false)}
              disabled={savingEdit}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={savingEdit}
            >
              {savingEdit ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Interview Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar entrevista?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la entrevista
              &quot;{interview.title ?? "Sin título"}&quot; y todos sus datos
              asociados (transcripción, análisis y participantes).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInterview}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reprocess Confirmation Dialog */}
      <Dialog open={reprocessDialogOpen} onOpenChange={setReprocessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Reprocesar entrevista?</DialogTitle>
            <DialogDescription>
              Se volverá a procesar la entrevista desde cero. Los resultados
              actuales (transcripción, entidades extraídas y análisis) serán
              sobreescritos con los nuevos resultados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReprocessDialogOpen(false)}
              disabled={reprocessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleReprocess}
              disabled={reprocessing}
            >
              {reprocessing ? "Procesando..." : "Reprocesar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Speaker Add/Edit Dialog */}
      <Dialog open={speakerDialogOpen} onOpenChange={setSpeakerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSpeakerIndex !== null
                ? "Editar Participante"
                : "Agregar Participante"}
            </DialogTitle>
            <DialogDescription>
              {editingSpeakerIndex !== null
                ? "Modifica los datos del participante."
                : "Ingresa los datos del participante de la entrevista."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="speaker-name">Nombre</Label>
              <Input
                id="speaker-name"
                placeholder="Nombre del participante"
                value={speakerForm.name}
                onChange={(e) =>
                  setSpeakerForm({ ...speakerForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="speaker-role">Cargo / Rol</Label>
              <Input
                id="speaker-role"
                placeholder="Ej: Gerente de Operaciones"
                value={speakerForm.role}
                onChange={(e) =>
                  setSpeakerForm({ ...speakerForm, role: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="speaker-department">Departamento / Área</Label>
              <Input
                id="speaker-department"
                placeholder="Ej: Operaciones"
                value={speakerForm.department}
                onChange={(e) =>
                  setSpeakerForm({
                    ...speakerForm,
                    department: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="speaker-interviewer"
                checked={speakerForm.isInterviewer}
                onCheckedChange={(checked) =>
                  setSpeakerForm({
                    ...speakerForm,
                    isInterviewer: checked === true,
                  })
                }
              />
              <Label
                htmlFor="speaker-interviewer"
                className="text-sm font-normal"
              >
                Es entrevistador (quien realiza las preguntas)
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="speaker-label">
                Etiqueta de hablante
                <HelpTooltip
                  text="Identificador único del hablante en la transcripción. Se asigna automáticamente, pero puedes cambiarlo si lo necesitas."
                  className="ml-1"
                />
              </Label>
              <Input
                id="speaker-label"
                placeholder="Ej: Speaker_0"
                value={speakerForm.speakerLabel}
                onChange={(e) =>
                  setSpeakerForm({
                    ...speakerForm,
                    speakerLabel: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSpeakerDialogOpen(false);
                setSpeakerForm(emptySpeakerForm);
                setEditingSpeakerIndex(null);
              }}
              disabled={savingSpeakers}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSpeaker}
              disabled={savingSpeakers || !speakerForm.speakerLabel.trim()}
            >
              {savingSpeakers
                ? "Guardando..."
                : editingSpeakerIndex !== null
                  ? "Guardar"
                  : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
