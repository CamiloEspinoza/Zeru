"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import {
  TENANT_HEADER,
  PROCESSING_STATUS_MESSAGES,
  type PipelineEvent,
  type PipelineLogEntry,
} from "@zeru/shared";
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
import { toast } from "sonner";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { TranscriptionPlayer } from "@/components/org-intelligence/transcription-player";
import { useSegmentEntities } from "@/components/org-intelligence/use-segment-entities";
import { SegmentEntityBadges } from "@/components/org-intelligence/segment-entity-badges";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProgressCelebration } from "@/components/org-intelligence/progress-celebration";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
import { useFirstVisit } from "@/hooks/use-first-visit";
import Link from "next/link";
import { InterviewQuestionsView } from "@/components/org-intelligence/interview-questions-view";
import { InterviewAudioStep } from "@/components/org-intelligence/interview-audio-step";
import { InterviewGuidePrint } from "@/components/org-intelligence/interview-guide-print";
import { InterviewHeader } from "@/components/org-intelligence/interview-header";
import { InterviewParticipantsCard } from "@/components/org-intelligence/interview-participants-card";
import { PipelineStatusCard } from "@/components/org-intelligence/pipeline-status-card";
import { ReprocessDialog } from "@/components/org-intelligence/reprocess-dialog";
import { EditInterviewDialog } from "@/components/org-intelligence/edit-interview-dialog";
import { pipelineSteps, getSpeakerColor } from "@/lib/org-intelligence/pipeline-config";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

interface Interview {
  id: string;
  title: string | null;
  interviewDate: string | null;
  processingStatus: string;
  processingError: string | null;
  processingLog: PipelineLogEntry[] | null;
  audioS3Key: string | null;
  audioMimeType: string | null;
  audioDurationMs: number | null;
  transcriptionText: string | null;
  transcriptionJson: Record<string, unknown> | null;
  transcriptionStatus: string;
  speakers: Speaker[];
  projectId: string;
  createdAt: string;
  objective?: string;
  generatedIntro?: string;
  generatedQuestions?: { introText: string; sections: { theme: string; questions: { text: string; rationale?: string; priority: string }[] }[] };
  questionsGeneratedAt?: string;
}

interface Speaker {
  id: string;
  speakerLabel: string;
  name: string | null;
  role: string | null;
  department: string | { id: string; name: string } | null;
  isInterviewer: boolean;
  personEntityId: string | null;
}

interface DirectoryPerson {
  id: string;
  name: string;
  role: string | null;
  department: { id: string; name: string; color: string | null } | null;
  personType: string;
  company: string | null;
  avatarS3Key: string | null;
}

interface SpeakerFormData {
  speakerLabel: string;
  name: string;
  role: string;
  department: string;
  isInterviewer: boolean;
  personEntityId: string | null;
}

interface TranscriptionSegment {
  speaker: string;
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  speakerConfidence?: number;
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
  personEntityId: null,
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
  const [processing, setProcessing] = useState(false);
  const [currentProcessingStatus, setCurrentProcessingStatus] = useState<string | null>(null);
  const [currentProcessingError, setCurrentProcessingError] = useState<string | null>(null);
  const [pipelineLog, setPipelineLog] = useState<PipelineLogEntry[]>([]);
  const sseAbortRef = useRef<AbortController | null>(null);

  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [speakerForm, setSpeakerForm] = useState<SpeakerFormData>(emptySpeakerForm);
  const [editingSpeakerIndex, setEditingSpeakerIndex] = useState<number | null>(null);
  const [savingSpeakers, setSavingSpeakers] = useState(false);

  const [searchMode, setSearchMode] = useState(true);
  const [personSearch, setPersonSearch] = useState("");
  const [searchResults, setSearchResults] = useState<DirectoryPerson[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<DirectoryPerson | null>(null);
  const [personAvatarUrls, setPersonAvatarUrls] = useState<Record<string, string>>({});
  const [speakerAvatarUrls, setSpeakerAvatarUrls] = useState<Record<string, string>>({});

  const isCompleted = (currentProcessingStatus ?? interview?.processingStatus) === "COMPLETED";
  const { segmentEntityMap } = useSegmentEntities(isCompleted ? interviewId : null);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", interviewDate: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [reprocessDialogOpen, setReprocessDialogOpen] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessFromStep, setReprocessFromStep] = useState("");

  const { isFirstVisit: showSuccessBanner, markVisited: dismissSuccessBanner } = useFirstVisit(`interview_completed_${interviewId}`);

  const [generatedSections, setGeneratedSections] = useState<{ theme: string; questions: { text: string; rationale?: string; priority: string }[] }[]>([]);
  const [generatedIntroText, setGeneratedIntroText] = useState("");

  const [questionsOpen, setQuestionsOpen] = useState(true);
  const questionsInitRef = useRef(false);

  const fetchInterview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<Interview>(
        `/org-intelligence/interviews/${interviewId}`,
      );
      setInterview(res);

      if (!questionsInitRef.current) {
        questionsInitRef.current = true;
        setQuestionsOpen(!res.audioS3Key);
      }

      if (res.generatedQuestions) {
        const gq = res.generatedQuestions as { introText?: string; sections?: typeof generatedSections };
        setGeneratedIntroText(gq.introText ?? res.generatedIntro ?? "");
        setGeneratedSections(gq.sections ?? []);
      }

      setCurrentProcessingStatus(res.processingStatus);
      setCurrentProcessingError(res.processingError);
      if (Array.isArray(res.processingLog) && res.processingLog.length > 0) {
        setPipelineLog(res.processingLog);
      }

      if (
        res.processingStatus !== "PENDING" &&
        res.processingStatus !== "UPLOADED" &&
        res.processingStatus !== "COMPLETED" &&
        res.processingStatus !== "FAILED"
      ) {
        connectSSE();
      }
    } catch (err) {
      console.error("Error al cargar entrevista:", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId]);

  const connectSSE = useCallback(() => {
    if (sseAbortRef.current) return;

    const tenantId =
      typeof window !== "undefined" ? localStorage.getItem("tenantId") : null;
    const token =
      typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    const abortController = new AbortController();
    sseAbortRef.current = abortController;

    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";
    const headers: Record<string, string> = { Accept: "text/event-stream" };
    if (tenantId) headers[TENANT_HEADER] = tenantId;
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${apiBase}/org-intelligence/interviews/${interviewId}/pipeline-events`, {
      headers,
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok || response.status === 204 || !response.body) {
          sseAbortRef.current = null;
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") {
              const res = await api.get<Interview>(
                `/org-intelligence/interviews/${interviewId}`,
              );
              setInterview(res);
              setCurrentProcessingStatus(res.processingStatus);
              setCurrentProcessingError(res.processingError);
              sseAbortRef.current = null;
              return;
            }
            try {
              const event = JSON.parse(payload) as PipelineEvent;
              if (event.type === "pipeline:status") {
                setCurrentProcessingStatus(event.status);
                if (event.status === "FAILED") {
                  setCurrentProcessingError(event.message);
                }
                setPipelineLog((prev) => [
                  ...prev,
                  { status: event.status, message: event.message, timestamp: event.timestamp },
                ]);
              } else if (event.type === "pipeline:progress") {
                setPipelineLog((prev) => [
                  ...prev,
                  { status: event.status, message: event.message, timestamp: event.timestamp },
                ]);
              }
            } catch {
              // ignore unparseable lines
            }
          }
        }
        sseAbortRef.current = null;
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("SSE connection error:", err);
        }
        sseAbortRef.current = null;
      });
  }, [interviewId]);

  const disconnectSSE = useCallback(() => {
    if (sseAbortRef.current) {
      sseAbortRef.current.abort();
      sseAbortRef.current = null;
    }
  }, []);

  useEffect(() => {
    fetchInterview();
    return () => {
      disconnectSSE();
    };
  }, [fetchInterview, disconnectSSE]);

  useEffect(() => {
    if (!personSearch.trim() || personSearch.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.get<{ data: DirectoryPerson[] }>(
          `/org-intelligence/persons?search=${encodeURIComponent(personSearch)}`,
        );
        const results = res.data ?? [];
        setSearchResults(results);
        results.forEach(async (person) => {
          if (person.avatarS3Key && !personAvatarUrls[person.id]) {
            try {
              const avatarRes = await api.get<{ url: string | null }>(
                `/org-intelligence/persons/${person.id}/avatar`,
              );
              if (avatarRes.url) {
                setPersonAvatarUrls((prev) => ({ ...prev, [person.id]: avatarRes.url! }));
              }
            } catch {
              // ignore avatar fetch errors
            }
          }
        });
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [personSearch, personAvatarUrls]);

  useEffect(() => {
    if (!interview?.speakers) return;
    interview.speakers.forEach(async (speaker) => {
      if (speaker.personEntityId && !speakerAvatarUrls[speaker.personEntityId]) {
        try {
          const res = await api.get<{ url: string | null }>(
            `/org-intelligence/persons/${speaker.personEntityId}/avatar`,
          );
          if (res.url) {
            setSpeakerAvatarUrls((prev) => ({
              ...prev,
              [speaker.personEntityId!]: res.url!,
            }));
          }
        } catch {
          // ignore avatar fetch errors
        }
      }
    });
  }, [interview?.speakers, speakerAvatarUrls]);

  const handleProcess = async () => {
    try {
      setProcessing(true);
      await api.post(`/org-intelligence/interviews/${interviewId}/process`, {});
      setCurrentProcessingStatus("TRANSCRIBING");
      setCurrentProcessingError(null);
      setPipelineLog([{
        status: "TRANSCRIBING",
        message: PROCESSING_STATUS_MESSAGES.TRANSCRIBING,
        timestamp: new Date().toISOString(),
      }]);
      connectSSE();
      await fetchInterview();
    } catch (err) {
      console.error("Error al iniciar procesamiento:", err);
      toast.error("No se pudo iniciar el procesamiento. Intenta nuevamente.");
    } finally {
      setProcessing(false);
    }
  };

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
      toast.error("No se pudo guardar los cambios.");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteInterview = async () => {
    try {
      setDeleting(true);
      await api.delete(`/org-intelligence/interviews/${interviewId}`);
      router.push(`/org-intelligence/projects/${id}`);
    } catch (err) {
      console.error("Error al eliminar entrevista:", err);
      toast.error("No se pudo eliminar la entrevista.");
    } finally {
      setDeleting(false);
    }
  };

  const handleReprocess = async () => {
    try {
      setReprocessing(true);
      const query = reprocessFromStep ? `?fromStep=${reprocessFromStep}` : "";
      await api.post(`/org-intelligence/interviews/${interviewId}/process${query}`, {});
      setReprocessDialogOpen(false);
      setReprocessFromStep("");
      const startStatus = reprocessFromStep || "TRANSCRIBING";
      setCurrentProcessingStatus(startStatus);
      setCurrentProcessingError(null);
      setPipelineLog([{
        status: startStatus,
        message: PROCESSING_STATUS_MESSAGES[startStatus as keyof typeof PROCESSING_STATUS_MESSAGES] ?? "Procesando...",
        timestamp: new Date().toISOString(),
      }]);
      disconnectSSE();
      connectSSE();
      await fetchInterview();
    } catch (err) {
      console.error("Error al reprocesar entrevista:", err);
      toast.error("No se pudo iniciar el reprocesamiento.");
    } finally {
      setReprocessing(false);
    }
  };

  const openAddSpeakerDialog = () => {
    const nextIndex = interview?.speakers?.length ?? 0;
    setSpeakerForm({ ...emptySpeakerForm, speakerLabel: `Speaker_${nextIndex}` });
    setEditingSpeakerIndex(null);
    setSearchMode(true);
    setPersonSearch("");
    setSearchResults([]);
    setSelectedPerson(null);
    setSpeakerDialogOpen(true);
  };

  const openEditSpeakerDialog = (index: number) => {
    if (!interview) return;
    const speaker = interview.speakers[index];
    const dept = typeof speaker.department === "string"
      ? speaker.department
      : speaker.department && typeof speaker.department === "object"
        ? (speaker.department as { name: string }).name
        : "";
    setSpeakerForm({
      speakerLabel: speaker.speakerLabel,
      name: speaker.name ?? "",
      role: speaker.role ?? "",
      department: dept,
      isInterviewer: speaker.isInterviewer,
      personEntityId: speaker.personEntityId ?? null,
    });
    setEditingSpeakerIndex(index);
    setSearchMode(false);
    setPersonSearch("");
    setSearchResults([]);
    setSelectedPerson(null);
    setSpeakerDialogOpen(true);
  };

  const handleSaveSpeaker = async () => {
    if (!interview || !speakerForm.speakerLabel.trim()) return;
    setSavingSpeakers(true);
    try {
      const currentSpeakers = interview.speakers.map((s) => {
        const dept = typeof s.department === "string"
          ? s.department
          : s.department && typeof s.department === "object"
            ? String((s.department as Record<string, string>).name ?? "")
            : undefined;
        return {
          speakerLabel: s.speakerLabel,
          name: s.name ?? undefined,
          role: s.role ?? undefined,
          department: dept || undefined,
          isInterviewer: s.isInterviewer ?? false,
          personEntityId: s.personEntityId || undefined,
        };
      });

      const newSpeakerData = {
        speakerLabel: speakerForm.speakerLabel,
        name: speakerForm.name || undefined,
        role: speakerForm.role || undefined,
        department: speakerForm.department || undefined,
        isInterviewer: speakerForm.isInterviewer,
        personEntityId: speakerForm.personEntityId ?? undefined,
      };

      let updatedSpeakers;
      if (editingSpeakerIndex !== null) {
        updatedSpeakers = [...currentSpeakers];
        updatedSpeakers[editingSpeakerIndex] = newSpeakerData;
      } else {
        updatedSpeakers = [...currentSpeakers, newSpeakerData];
      }

      await api.patch(`/org-intelligence/interviews/${interviewId}/speakers`, { speakers: updatedSpeakers });
      await fetchInterview();
      setSpeakerDialogOpen(false);
      setSpeakerForm(emptySpeakerForm);
      setEditingSpeakerIndex(null);
    } catch (err) {
      console.error("Error al guardar participante:", err);
      toast.error("No se pudo guardar el participante.");
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
          personEntityId: s.personEntityId ?? undefined,
        }));

      await api.patch(`/org-intelligence/interviews/${interviewId}/speakers`, { speakers: updatedSpeakers });
      await fetchInterview();
    } catch (err) {
      console.error("Error al eliminar participante:", err);
      toast.error("No se pudo eliminar el participante.");
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
        <Button variant="outline" onClick={() => router.push(`/org-intelligence/projects/${id}`)}>
          Volver al proyecto
        </Button>
      </div>
    );
  }

  const currentStatus = currentProcessingStatus ?? interview.processingStatus;
  const isProcessing = pipelineSteps.indexOf(currentStatus) > 0 && currentStatus !== "COMPLETED";
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

  const speakerMap = new Map<string, number>();
  const speakerNameMap = new Map<string, string>();
  for (let idx = 0; idx < interview.speakers.length; idx++) {
    const s = interview.speakers[idx];
    if (s.name) {
      speakerNameMap.set(s.speakerLabel, s.name);
      speakerNameMap.set(`Speaker_${idx}`, s.name);
    }
  }

  return (
    <div className="space-y-6">
      <InterviewHeader
        title={interview.title}
        date={formatDate(interview.interviewDate ?? interview.createdAt)}
        currentStatus={currentStatus}
        onEdit={openEditDialog}
        onReprocess={() => setReprocessDialogOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
        projectId={id}
        reprocessing={reprocessing}
      />

      <InterviewParticipantsCard
        speakers={interview.speakers}
        avatarUrls={speakerAvatarUrls}
        onAdd={openAddSpeakerDialog}
        onEdit={openEditSpeakerDialog}
        onDelete={handleDeleteSpeaker}
        saving={savingSpeakers}
      />

      {/* Interview Objective */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Objetivo de la entrevista</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {interview.objective ?? "Sin objetivo definido."}
          </p>
        </CardContent>
      </Card>

      {/* Question Guide — collapsible, auto-collapsed when audio exists */}
      <Collapsible open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <CardTitle>Guía de Preguntas</CardTitle>
                <HugeiconsIcon
                  icon={ArrowDown01Icon}
                  className={`size-4 text-muted-foreground transition-transform ${
                    questionsOpen ? "rotate-180" : ""
                  }`}
                />
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <InterviewQuestionsView
                introText={generatedIntroText}
                sections={generatedSections}
                interviewId={interviewId}
                onQuestionsChange={(sections) => setGeneratedSections(sections)}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Audio Upload/Recording */}
      <InterviewAudioStep
        interviewId={interviewId}
        hasAudio={!!interview.audioS3Key}
        onAudioUploaded={fetchInterview}
      />


      {/* Audio Uploaded — show filename and process button */}
      {showProcess && interview.audioS3Key?.split("/").pop() && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Audio Subido</CardTitle>
              <HelpTooltip text="Al procesar, la IA transcribirá el audio, identificará quién habla, extraerá roles, procesos, problemas y dependencias, y generará un mapa de conocimiento organizacional." />
            </div>
            <CardDescription>{interview.audioS3Key?.split("/").pop()}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleProcess} disabled={processing}>
              {processing ? "Iniciando..." : "Procesar"}
            </Button>
          </CardContent>
        </Card>
      )}

      {showPipeline && (
        <PipelineStatusCard
          currentStatus={currentStatus}
          pipelineLog={pipelineLog}
          processingError={currentProcessingError ?? interview.processingError}
        />
      )}

      {currentStatus === "COMPLETED" && showSuccessBanner && (
        <ProgressCelebration
          title="Entrevista procesada exitosamente"
          message="La IA extrajo conocimiento organizacional de la conversación."
          actions={[
            { label: "Ir a Análisis", href: `/org-intelligence/projects/${id}?tab=analysis` },
            { label: "Ir a Diagnóstico", href: `/org-intelligence/projects/${id}?tab=diagnosis` },
          ]}
          onDismiss={dismissSuccessBanner}
        />
      )}

      {/* Transcription */}
      {showTranscription && interview.transcriptionJson && (() => {
        const segments = ((interview.transcriptionJson as Record<string, unknown>).segments as TranscriptionSegment[]) ?? [];
        const hasAudio = !!interview.audioS3Key;

        return (
          <Card>
            <CardHeader>
              <CardTitle>Transcripción</CardTitle>
              <CardDescription>
                Transcripción con identificación de hablantes. {segments.length} segmentos.
                {hasAudio && " Haz clic en un segmento para ir a ese momento del audio."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasAudio ? (
                <TranscriptionPlayer
                  interviewId={interview.id}
                  segments={segments}
                  speakerNameMap={speakerNameMap}
                  durationMs={interview.audioDurationMs ?? 0}
                  segmentEntityMap={segmentEntityMap}
                />
              ) : (
                <div className="max-h-[600px] space-y-3 overflow-y-auto pr-2">
                  {segments.map((segment: TranscriptionSegment, i: number) => (
                    <div key={i} className="flex gap-3">
                      <div className="shrink-0 pt-0.5">
                        <Badge
                          variant="outline"
                          className={getSpeakerColor(segment.speaker, speakerMap)}
                        >
                          {speakerNameMap.get(segment.speaker) ?? segment.speaker}
                        </Badge>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed">{segment.text}</p>
                        {segment.startMs != null && (
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimestamp(segment.startMs / 1000)}
                            {segment.endMs != null && ` - ${formatTimestamp(segment.endMs / 1000)}`}
                          </span>
                        )}
                        {segmentEntityMap.get(i) && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <SegmentEntityBadges entities={segmentEntityMap.get(i)!} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      <InterviewGuidePrint
        interviewTitle={interview.title ?? "Entrevista sin titulo"}
        interviewDate={interview.interviewDate ? new Date(interview.interviewDate).toLocaleDateString("es-CL") : undefined}
        speakers={interview.speakers.map((s) => ({ name: s.name ?? s.speakerLabel, role: s.role ?? undefined, isInterviewer: s.isInterviewer }))}
        introText={generatedIntroText}
        sections={generatedSections}
        projectName={id}
      />

      <EditInterviewDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title={editForm.title}
        onTitleChange={(t) => setEditForm({ ...editForm, title: t })}
        onSave={handleSaveEdit}
        saving={savingEdit}
      />

      {/* Delete Interview Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar entrevista?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la entrevista
              &quot;{interview.title ?? "Sin título"}&quot; y todos sus datos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteInterview} disabled={deleting}>
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReprocessDialog
        open={reprocessDialogOpen}
        onOpenChange={(open) => {
          setReprocessDialogOpen(open);
          if (!open) setReprocessFromStep("");
        }}
        fromStep={reprocessFromStep}
        onFromStepChange={setReprocessFromStep}
        onReprocess={handleReprocess}
        reprocessing={reprocessing}
      />

      {/* Speaker Add/Edit Dialog */}
      <Dialog open={speakerDialogOpen} onOpenChange={(open) => {
        setSpeakerDialogOpen(open);
        if (!open) {
          setSpeakerForm(emptySpeakerForm);
          setEditingSpeakerIndex(null);
          setSearchMode(true);
          setPersonSearch("");
          setSearchResults([]);
          setSelectedPerson(null);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingSpeakerIndex !== null ? "Editar Participante" : "Agregar Participante"}
            </DialogTitle>
            <DialogDescription>
              {editingSpeakerIndex !== null
                ? "Modifica los datos del participante."
                : "Busca en el directorio o agrega un participante nuevo."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingSpeakerIndex === null && searchMode && !selectedPerson && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Buscar en el directorio</Label>
                  <Input
                    placeholder="Buscar persona por nombre..."
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                {searchResults.length > 0 && (
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                    {searchResults.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground [&:hover_.text-muted-foreground]:text-accent-foreground/70"
                        onClick={() => {
                          setSelectedPerson(person);
                          setSpeakerForm({
                            speakerLabel: person.name,
                            name: person.name,
                            role: person.role ?? "",
                            department: person.department?.name ?? "",
                            isInterviewer: false,
                            personEntityId: person.id,
                          });
                          setSearchMode(false);
                        }}
                      >
                        <PersonAvatar
                          name={person.name}
                          avatarUrl={personAvatarUrls[person.id] ?? null}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium">{person.name}</span>
                            {person.personType === "EXTERNAL" && (
                              <Badge variant="secondary" className="shrink-0 text-[9px] px-1 py-0">
                                Externo
                              </Badge>
                            )}
                            {person.personType === "CONTRACTOR" && (
                              <Badge variant="secondary" className="shrink-0 text-[9px] px-1 py-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                Contratista
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-1.5 text-xs text-muted-foreground">
                            {person.role && <span className="truncate">{person.role}</span>}
                            {person.role && person.department?.name && <span>·</span>}
                            {person.department?.name && <span className="truncate">{person.department.name}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {personSearch.length >= 2 && searchResults.length === 0 && (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    No se encontraron personas.{" "}
                    <Link href="/personas/directorio" className="text-primary underline underline-offset-2">
                      Ir al directorio
                    </Link>
                  </p>
                )}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">o</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => { setSearchMode(false); setSelectedPerson(null); }}
                >
                  Agregar persona que no está en directorio
                </Button>
              </div>
            )}

            {selectedPerson && editingSpeakerIndex === null && (
              <div className="flex items-center gap-3 rounded-md border bg-accent/50 p-3">
                <PersonAvatar
                  name={selectedPerson.name}
                  avatarUrl={personAvatarUrls[selectedPerson.id] ?? null}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{selectedPerson.name}</span>
                  <p className="text-xs text-muted-foreground">Seleccionado del directorio</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedPerson(null);
                    setSpeakerForm({
                      ...emptySpeakerForm,
                      speakerLabel: `Speaker_${interview?.speakers?.length ?? 0}`,
                    });
                    setSearchMode(true);
                    setPersonSearch("");
                  }}
                >
                  Cambiar
                </Button>
              </div>
            )}

            {(!searchMode || editingSpeakerIndex !== null) && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="speaker-name">Nombre</Label>
                  <Input
                    id="speaker-name"
                    placeholder="Nombre del participante"
                    value={speakerForm.name}
                    onChange={(e) => setSpeakerForm({ ...speakerForm, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="speaker-role">Cargo / Rol</Label>
                  <Input
                    id="speaker-role"
                    placeholder="Ej: Gerente de Operaciones"
                    value={speakerForm.role}
                    onChange={(e) => setSpeakerForm({ ...speakerForm, role: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="speaker-department">Departamento / Área</Label>
                  <Input
                    id="speaker-department"
                    placeholder="Ej: Operaciones"
                    value={speakerForm.department}
                    onChange={(e) => setSpeakerForm({ ...speakerForm, department: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="speaker-interviewer"
                    checked={speakerForm.isInterviewer}
                    onCheckedChange={(checked) =>
                      setSpeakerForm({ ...speakerForm, isInterviewer: checked === true })
                    }
                  />
                  <Label htmlFor="speaker-interviewer" className="text-sm font-normal">
                    Es entrevistador (quien realiza las preguntas)
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="speaker-label">
                    Etiqueta de hablante
                    <HelpTooltip
                      text="Identificador único del hablante en la transcripción. Se asigna automáticamente."
                      className="ml-1"
                    />
                  </Label>
                  <Input
                    id="speaker-label"
                    placeholder="Ej: Speaker_0"
                    value={speakerForm.speakerLabel}
                    onChange={(e) => setSpeakerForm({ ...speakerForm, speakerLabel: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          {(!searchMode || editingSpeakerIndex !== null) && (
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
                {savingSpeakers ? "Guardando..." : editingSpeakerIndex !== null ? "Guardar" : "Agregar"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
