"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectAnalysisTab } from "@/components/org-intelligence/project-analysis-tab";
import { ProjectDiagnosisTab } from "@/components/org-intelligence/project-diagnosis-tab";
import { ProjectImprovementsTab } from "@/components/org-intelligence/project-improvements-tab";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { PersonSearchSelect } from "@/components/org-intelligence/person-search-select";
import { SpeakerList, type SpeakerItem } from "@/components/org-intelligence/speaker-list";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalCircle01Icon,
  Edit02Icon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    interviews: number;
    entities: number;
    problems: number;
  };
}

interface InterviewSpeaker {
  id: string;
  speakerLabel: string;
  name: string | null;
  role: string | null;
  department: string | null;
  isInterviewer: boolean;
}

interface Interview {
  id: string;
  title: string | null;
  interviewDate: string | null;
  processingStatus: string;
  speakers: InterviewSpeaker[];
  createdAt: string;
  _count?: {
    speakers?: number;
    chunks?: number;
  };
}

interface InterviewsResponse {
  data: Interview[];
  meta: { total: number; page: number; perPage: number };
}

const PROJECT_STATUSES = [
  { value: "DRAFT", label: "Borrador" },
  { value: "ACTIVE", label: "Activo" },
  { value: "COMPLETED", label: "Completado" },
  { value: "ARCHIVED", label: "Archivado" },
];

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "interviews";

  const [project, setProject] = useState<Project | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    date: "",
    objective: "",
  });
  const [interviewSpeakers, setInterviewSpeakers] = useState<SpeakerItem[]>([]);
  const [manualMode, setManualMode] = useState(false);
  const [manualForm, setManualForm] = useState({
    name: "",
    role: "",
    department: "",
    isInterviewer: false,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);

  // Delete project state
  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  // Status change state
  const [changingStatus, setChangingStatus] = useState(false);

  // Edit interview state
  const [editInterviewDialogOpen, setEditInterviewDialogOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [editInterviewForm, setEditInterviewForm] = useState({
    title: "",
  });
  const [savingInterview, setSavingInterview] = useState(false);

  // Delete interview state
  const [deleteInterviewDialogOpen, setDeleteInterviewDialogOpen] = useState(false);
  const [deletingInterview, setDeletingInterview] = useState<Interview | null>(null);
  const [deletingInterviewLoading, setDeletingInterviewLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      setLoadingProject(true);
      const res = await api.get<Project>(
        `/org-intelligence/projects/${id}`,
      );
      setProject(res);
      setEditForm({
        name: res.name,
        description: res.description ?? "",
        startDate: res.startDate
          ? new Date(res.startDate).toISOString().split("T")[0]
          : "",
        endDate: res.endDate
          ? new Date(res.endDate).toISOString().split("T")[0]
          : "",
      });
    } catch (err) {
      console.error("Error al cargar proyecto:", err);
    } finally {
      setLoadingProject(false);
    }
  }, [id]);

  const fetchInterviews = useCallback(async () => {
    try {
      setLoadingInterviews(true);
      const res = await api.get<InterviewsResponse>(
        `/org-intelligence/interviews?projectId=${id}`,
      );
      setInterviews(res.data);
    } catch (err) {
      console.error("Error al cargar entrevistas:", err);
    } finally {
      setLoadingInterviews(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchInterviews();
  }, [fetchProject, fetchInterviews]);

  const resetInterviewDialog = () => {
    setInterviewForm({ title: "", date: "", objective: "" });
    setInterviewSpeakers([]);
    setManualMode(false);
    setManualForm({ name: "", role: "", department: "", isInterviewer: false });
  };

  const handleCreateInterview = async () => {
    try {
      setCreating(true);

      const speakers =
        interviewSpeakers.length > 0
          ? interviewSpeakers.map((s, i) => ({
              speakerLabel: `Speaker_${i}`,
              name: s.name,
              role: s.role || undefined,
              department: s.department || undefined,
              isInterviewer: s.isInterviewer,
            }))
          : undefined;

      const created = await api.post<{ id: string }>(
        "/org-intelligence/interviews",
        {
          projectId: id,
          title: interviewForm.title || undefined,
          interviewDate: interviewForm.date
            ? new Date(interviewForm.date + "T12:00:00").toISOString()
            : undefined,
          objective: interviewForm.objective || undefined,
          speakers,
        },
      );

      setDialogOpen(false);
      resetInterviewDialog();
      await fetchInterviews();

      // Navigate to the new interview to continue configuration
      if (created?.id) {
        router.push(
          `/org-intelligence/projects/${id}/interviews/${created.id}`,
        );
      }
    } catch (err) {
      console.error("Error al crear entrevista:", err);
      toast.error("No se pudo crear la entrevista. Intenta nuevamente.");
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProject = async () => {
    try {
      setSaving(true);
      await api.patch(`/org-intelligence/projects/${id}`, {
        name: editForm.name,
        description: editForm.description || undefined,
        startDate: editForm.startDate ? new Date(editForm.startDate + "T12:00:00").toISOString() : undefined,
        endDate: editForm.endDate ? new Date(editForm.endDate + "T12:00:00").toISOString() : undefined,
      });
      await fetchProject();
    } catch (err) {
      console.error("Error al guardar proyecto:", err);
      toast.error("No se pudo guardar los cambios del proyecto.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      await api.delete(`/org-intelligence/projects/${id}`);
      router.push("/org-intelligence/projects");
    } catch (err) {
      console.error("Error al eliminar proyecto:", err);
      toast.error("No se pudo eliminar el proyecto.");
    } finally {
      setDeletingProject(false);
    }
  };

  const handleChangeStatus = async (newStatus: string) => {
    try {
      setChangingStatus(true);
      await api.patch(`/org-intelligence/projects/${id}`, {
        status: newStatus,
      });
      await fetchProject();
    } catch (err) {
      console.error("Error al cambiar estado:", err);
      toast.error("No se pudo cambiar el estado del proyecto.");
    } finally {
      setChangingStatus(false);
    }
  };

  const openEditInterviewDialog = (interview: Interview) => {
    setEditingInterview(interview);
    setEditInterviewForm({
      title: interview.title ?? "",
    });
    setEditInterviewDialogOpen(true);
  };

  const handleEditInterview = async () => {
    if (!editingInterview) return;
    try {
      setSavingInterview(true);
      await api.patch(`/org-intelligence/interviews/${editingInterview.id}`, {
        title: editInterviewForm.title || undefined,
      });
      setEditInterviewDialogOpen(false);
      setEditingInterview(null);
      await fetchInterviews();
    } catch (err) {
      console.error("Error al editar entrevista:", err);
      toast.error("No se pudo guardar los cambios de la entrevista.");
    } finally {
      setSavingInterview(false);
    }
  };

  const openDeleteInterviewDialog = (interview: Interview) => {
    setDeletingInterview(interview);
    setDeleteInterviewDialogOpen(true);
  };

  const handleDeleteInterview = async () => {
    if (!deletingInterview) return;
    try {
      setDeletingInterviewLoading(true);
      await api.delete(`/org-intelligence/interviews/${deletingInterview.id}`);
      setDeleteInterviewDialogOpen(false);
      setDeletingInterview(null);
      await fetchInterviews();
    } catch (err) {
      console.error("Error al eliminar entrevista:", err);
      toast.error("No se pudo eliminar la entrevista.");
    } finally {
      setDeletingInterviewLoading(false);
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

  if (loadingProject) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Proyecto no encontrado.</p>
        <Button
          variant="outline"
          onClick={() => router.push("/org-intelligence/projects")}
        >
          Volver a proyectos
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <StatusBadge type="project" value={project.status} />
          </div>
          {project.description && (
            <p className="text-sm text-muted-foreground">
              {project.description}
            </p>
          )}
          <div className="flex gap-3 text-xs text-muted-foreground">
            {project.startDate && (
              <span>Inicio: {formatDate(project.startDate)}</span>
            )}
            {project.endDate && (
              <span>Fin: {formatDate(project.endDate)}</span>
            )}
            <span>Creado: {formatDate(project.createdAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={project.status}
            onValueChange={handleChangeStatus}
            disabled={changingStatus}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => setDeleteProjectDialogOpen(true)}
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            <span className="sr-only">Eliminar proyecto</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/org-intelligence/projects")}
          >
            Volver
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={initialTab}>
        <div className="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="interviews">
            Entrevistas{interviews.length > 0 ? ` (${interviews.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="analysis">
            Análisis{(project._count?.entities ?? 0) > 0 ? ` (${project._count?.entities ?? 0})` : <span className="ml-1 opacity-60">(pendiente)</span>}
          </TabsTrigger>
          <TabsTrigger value="diagnosis">
            Diagnóstico{(project._count?.problems ?? 0) > 0 ? ` (${project._count?.problems ?? 0})` : <span className="ml-1 opacity-60">(pendiente)</span>}
          </TabsTrigger>
          <TabsTrigger value="action-plan">Plan de Acción</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
        </TabsList>
        <HelpTooltip
          iconSize="md"
          text={
            <div className="space-y-2 py-1">
              <p><strong>Entrevistas:</strong> Gestiona entrevistas, sube audio y lanza el procesamiento con IA.</p>
              <p><strong>Análisis:</strong> Análisis cruzado con entidades extraídas, problemas detectados y estadísticas generales.</p>
              <p><strong>Diagnóstico:</strong> Detecta cuellos de botella, puntos únicos de fallo y contradicciones entre entrevistados.</p>
              <p><strong>Plan de Acción:</strong> Mejoras priorizadas con framework RICE y matriz esfuerzo-impacto.</p>
              <p><strong>Configuración:</strong> Edita nombre, descripción y fechas del proyecto.</p>
            </div>
          }
        />
        </div>

        {/* Entrevistas Tab */}
        <TabsContent value="interviews" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Entrevistas ({interviews.length})
            </h2>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={() => setDialogOpen(true)}>
                Nueva Entrevista
              </Button>
              <p className="text-xs text-muted-foreground">
                Agrega una entrevista. Después podrás subir el audio para que sea procesado automáticamente.
              </p>
            </div>
          </div>

          {loadingInterviews ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-3 w-1/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : interviews.length === 0 ? (
            <EducationalEmptyState
              icon={
                <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
                  <path d="M12 8v4l2.5 2.5" />
                  <path d="M19.5 4.5l-2 2M4.5 4.5l2 2" />
                </svg>
              }
              title="Agrega tu primera entrevista"
              description="Cada entrevista es una conversación grabada con un coordinador de área. Configura los participantes, sube el audio y la IA extraerá roles, procesos, problemas y dependencias automáticamente."
              action={{ label: "Crear entrevista", onClick: () => setDialogOpen(true) }}
              tip="Tip: Entrevistas de 60-90 minutos dan los mejores resultados. Asegúrate de que el audio tenga buena calidad."
            />
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => (
                <Card
                  key={interview.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50"
                  onClick={() =>
                    router.push(
                      `/org-intelligence/projects/${id}/interviews/${interview.id}`,
                    )
                  }
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm">
                        {interview.title ?? "Entrevista sin título"}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <StatusBadge type="processing" value={interview.processingStatus} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <HugeiconsIcon
                                icon={MoreHorizontalCircle01Icon}
                                className="size-4"
                              />
                              <span className="sr-only">Acciones</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/org-intelligence/projects/${id}/interviews/${interview.id}`,
                                )
                              }
                            >
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openEditInterviewDialog(interview)}
                            >
                              <HugeiconsIcon
                                icon={Edit02Icon}
                                className="mr-2 size-4"
                              />
                              Editar título
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => openDeleteInterviewDialog(interview)}
                            >
                              <HugeiconsIcon
                                icon={Delete02Icon}
                                className="mr-2 size-4"
                              />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    <CardDescription>
                      {formatDate(interview.interviewDate ?? interview.createdAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {interview.speakers && interview.speakers.length > 0 ? (
                        interview.speakers.map((speaker) => (
                          <Badge
                            key={speaker.id}
                            variant={speaker.isInterviewer ? "default" : "secondary"}
                            className="text-[10px]"
                          >
                            {speaker.name ?? speaker.speakerLabel}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground/70">
                          Sin participantes configurados
                        </span>
                      )}
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Análisis Tab */}
        <TabsContent value="analysis" className="pt-4">
          <ProjectAnalysisTab projectId={id} />
        </TabsContent>

        {/* Diagnóstico Tab */}
        <TabsContent value="diagnosis" className="pt-4">
          <ProjectDiagnosisTab projectId={id} />
        </TabsContent>

        {/* Plan de Acción Tab */}
        <TabsContent value="action-plan" className="pt-4">
          <ProjectImprovementsTab projectId={id} />
        </TabsContent>

        {/* Configuración Tab */}
        <TabsContent value="settings" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Proyecto</CardTitle>
              <CardDescription>
                Modifica los datos del proyecto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-description">Descripción</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-start">Fecha de inicio</Label>
                  <Input
                    id="edit-start"
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        startDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-end">Fecha de fin</Label>
                  <Input
                    id="edit-end"
                    type="date"
                    value={editForm.endDate}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        endDate: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSaveProject}
                disabled={!editForm.name.trim() || saving}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Interview Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetInterviewDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Entrevista</DialogTitle>
            <DialogDescription>
              Agrega una nueva entrevista al proyecto. Puedes agregar participantes desde el directorio o manualmente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="interview-title">Título</Label>
              <Input
                id="interview-title"
                placeholder="Título de la entrevista"
                value={interviewForm.title}
                onChange={(e) =>
                  setInterviewForm({
                    ...interviewForm,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-date">Fecha</Label>
              <Input
                id="interview-date"
                type="date"
                value={interviewForm.date}
                onChange={(e) =>
                  setInterviewForm({
                    ...interviewForm,
                    date: e.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="interview-objective">
                Objetivo
                <HelpTooltip
                  text="Describe brevemente el objetivo de la entrevista o el contexto en que se realizó. Esto ayuda a la IA a interpretar mejor las respuestas."
                  className="ml-1"
                />
              </Label>
              <Textarea
                id="interview-objective"
                placeholder="Ej: Entrevista exploratoria sobre procesos de onboarding del área de RRHH"
                value={interviewForm.objective}
                onChange={(e) =>
                  setInterviewForm({
                    ...interviewForm,
                    objective: e.target.value,
                  })
                }
                rows={2}
              />
            </div>

            {/* Participants */}
            <div className="space-y-2">
              <Label>Participantes</Label>
              <PersonSearchSelect
                onSelect={(person) => {
                  setInterviewSpeakers((prev) => [
                    ...prev,
                    {
                      speakerLabel: `Speaker_${prev.length}`,
                      name: person.name,
                      role: person.role,
                      department: person.department,
                      isInterviewer: false,
                      personEntityId: person.id,
                    },
                  ]);
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setManualMode((v) => !v)}
              >
                {manualMode ? "Cancelar" : "+ Agregar manualmente"}
              </Button>

              {manualMode && (
                <div className="space-y-2 rounded-md border p-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="manual-name" className="text-xs">
                      Nombre *
                    </Label>
                    <Input
                      id="manual-name"
                      placeholder="Nombre del participante"
                      value={manualForm.name}
                      onChange={(e) =>
                        setManualForm({ ...manualForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-role" className="text-xs">
                        Cargo / Rol
                      </Label>
                      <Input
                        id="manual-role"
                        placeholder="Ej: Gerente"
                        value={manualForm.role}
                        onChange={(e) =>
                          setManualForm({ ...manualForm, role: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="manual-dept" className="text-xs">
                        Area
                      </Label>
                      <Input
                        id="manual-dept"
                        placeholder="Ej: Operaciones"
                        value={manualForm.department}
                        onChange={(e) =>
                          setManualForm({
                            ...manualForm,
                            department: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="manual-interviewer"
                      checked={manualForm.isInterviewer}
                      onCheckedChange={(checked) =>
                        setManualForm({
                          ...manualForm,
                          isInterviewer: checked === true,
                        })
                      }
                    />
                    <Label
                      htmlFor="manual-interviewer"
                      className="text-sm font-normal"
                    >
                      Es entrevistador
                    </Label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!manualForm.name.trim()}
                    onClick={() => {
                      if (!manualForm.name.trim()) return;
                      setInterviewSpeakers((prev) => [
                        ...prev,
                        {
                          speakerLabel: `Speaker_${prev.length}`,
                          name: manualForm.name.trim(),
                          role: manualForm.role || undefined,
                          department: manualForm.department || undefined,
                          isInterviewer: manualForm.isInterviewer,
                        },
                      ]);
                      setManualForm({
                        name: "",
                        role: "",
                        department: "",
                        isInterviewer: false,
                      });
                      setManualMode(false);
                    }}
                  >
                    Agregar
                  </Button>
                </div>
              )}

              <SpeakerList
                speakers={interviewSpeakers}
                onRemove={(index) =>
                  setInterviewSpeakers((prev) =>
                    prev.filter((_, i) => i !== index),
                  )
                }
                onToggleInterviewer={(index) =>
                  setInterviewSpeakers((prev) =>
                    prev.map((s, i) =>
                      i === index
                        ? { ...s, isInterviewer: !s.isInterviewer }
                        : s,
                    ),
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetInterviewDialog();
              }}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateInterview} disabled={creating}>
              {creating ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteProjectDialogOpen} onOpenChange={setDeleteProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar proyecto?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará el proyecto
              &quot;{project.name}&quot; y todos sus datos asociados
              (entrevistas, análisis y diagnósticos).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteProjectDialogOpen(false)}
              disabled={deletingProject}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteProject}
              disabled={deletingProject}
            >
              {deletingProject ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Interview Dialog */}
      <Dialog open={editInterviewDialogOpen} onOpenChange={setEditInterviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Entrevista</DialogTitle>
            <DialogDescription>
              Modifica el título de la entrevista.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-interview-title">Título</Label>
              <Input
                id="edit-interview-title"
                placeholder="Título de la entrevista"
                value={editInterviewForm.title}
                onChange={(e) =>
                  setEditInterviewForm({
                    ...editInterviewForm,
                    title: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditInterviewDialogOpen(false)}
              disabled={savingInterview}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditInterview}
              disabled={savingInterview}
            >
              {savingInterview ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Interview Confirmation Dialog */}
      <Dialog open={deleteInterviewDialogOpen} onOpenChange={setDeleteInterviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar entrevista?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la entrevista
              &quot;{deletingInterview?.title ?? "Sin título"}&quot; y todos sus datos asociados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteInterviewDialogOpen(false)}
              disabled={deletingInterviewLoading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteInterview}
              disabled={deletingInterviewLoading}
            >
              {deletingInterviewLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
