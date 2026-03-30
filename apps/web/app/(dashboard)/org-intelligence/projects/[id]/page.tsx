"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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

  const [project, setProject] = useState<Project | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    date: "",
    description: "",
    addSpeaker: false,
    speakerName: "",
    speakerRole: "",
    speakerDepartment: "",
    speakerIsInterviewer: false,
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
    } catch {
      // silently fail
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
    } catch {
      // silently fail
    } finally {
      setLoadingInterviews(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
    fetchInterviews();
  }, [fetchProject, fetchInterviews]);

  const handleCreateInterview = async () => {
    try {
      setCreating(true);

      const speakers =
        interviewForm.addSpeaker && interviewForm.speakerName.trim()
          ? [
              {
                speakerLabel: "Speaker_0",
                name: interviewForm.speakerName,
                role: interviewForm.speakerRole || undefined,
                department: interviewForm.speakerDepartment || undefined,
                isInterviewer: interviewForm.speakerIsInterviewer,
              },
            ]
          : undefined;

      const created = await api.post<{ id: string }>(
        "/org-intelligence/interviews",
        {
          projectId: id,
          title: interviewForm.title || undefined,
          interviewDate: interviewForm.date
            ? new Date(interviewForm.date + "T12:00:00").toISOString()
            : undefined,
          speakers,
        },
      );

      setDialogOpen(false);
      setInterviewForm({
        title: "",
        date: "",
        description: "",
        addSpeaker: false,
        speakerName: "",
        speakerRole: "",
        speakerDepartment: "",
        speakerIsInterviewer: false,
      });
      await fetchInterviews();

      // Navigate to the new interview to continue configuration
      if (created?.id) {
        router.push(
          `/org-intelligence/projects/${id}/interviews/${created.id}`,
        );
      }
    } catch {
      // silently fail
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
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      setDeletingProject(true);
      await api.delete(`/org-intelligence/projects/${id}`);
      router.push("/org-intelligence/projects");
    } catch {
      // silently fail
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
    } catch {
      // silently fail
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
    } catch {
      // silently fail
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
    } catch {
      // silently fail
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
      <Tabs defaultValue="interviews">
        <TabsList>
          <TabsTrigger value="interviews">
            Entrevistas{interviews.length > 0 ? ` (${interviews.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="analysis">
            Análisis{(project._count?.entities ?? 0) > 0 ? ` (${project._count!.entities})` : <span className="ml-1 text-muted-foreground">(pendiente)</span>}
          </TabsTrigger>
          <TabsTrigger value="diagnosis">
            Diagnóstico{(project._count?.problems ?? 0) > 0 ? ` (${project._count!.problems})` : <span className="ml-1 text-muted-foreground">(pendiente)</span>}
          </TabsTrigger>
          <TabsTrigger value="action-plan">Plan de Acción</TabsTrigger>
          <TabsTrigger value="settings">Configuración</TabsTrigger>
          <HelpTooltip
            iconSize="md"
            text="Entrevistas: gestiona entrevistas, sube audio y lanza el procesamiento con IA. Análisis: análisis cruzado con entidades extraídas, problemas y estadísticas. Diagnóstico: detecta cuellos de botella, puntos únicos de fallo (SPOF) y contradicciones. Plan de Acción: mejoras priorizadas con framework RICE y matriz esfuerzo-impacto. Configuración: edita nombre, descripción y fechas del proyecto."
          />
        </TabsList>

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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva Entrevista</DialogTitle>
            <DialogDescription>
              Agrega una nueva entrevista al proyecto. Después podrás configurar participantes y subir el audio.
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
              <Label htmlFor="interview-description">
                Contexto / Descripción
                <HelpTooltip
                  text="Describe brevemente el objetivo de la entrevista o el contexto en que se realizó. Esto ayuda a la IA a interpretar mejor las respuestas."
                  className="ml-1"
                />
              </Label>
              <Textarea
                id="interview-description"
                placeholder="Ej: Entrevista exploratoria sobre procesos de onboarding del área de RRHH"
                value={interviewForm.description}
                onChange={(e) =>
                  setInterviewForm({
                    ...interviewForm,
                    description: e.target.value,
                  })
                }
                rows={2}
              />
            </div>

            {/* Optional first speaker */}
            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="add-first-speaker"
                  checked={interviewForm.addSpeaker}
                  onCheckedChange={(checked) =>
                    setInterviewForm({
                      ...interviewForm,
                      addSpeaker: checked === true,
                    })
                  }
                />
                <Label
                  htmlFor="add-first-speaker"
                  className="text-sm font-normal"
                >
                  Agregar un primer participante ahora
                </Label>
              </div>

              {interviewForm.addSpeaker && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-speaker-name">Nombre</Label>
                    <Input
                      id="first-speaker-name"
                      placeholder="Nombre del participante"
                      value={interviewForm.speakerName}
                      onChange={(e) =>
                        setInterviewForm({
                          ...interviewForm,
                          speakerName: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="first-speaker-role">Cargo / Rol</Label>
                      <Input
                        id="first-speaker-role"
                        placeholder="Ej: Gerente de Operaciones"
                        value={interviewForm.speakerRole}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            speakerRole: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="first-speaker-dept">Área</Label>
                      <Input
                        id="first-speaker-dept"
                        placeholder="Ej: Operaciones"
                        value={interviewForm.speakerDepartment}
                        onChange={(e) =>
                          setInterviewForm({
                            ...interviewForm,
                            speakerDepartment: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="first-speaker-interviewer"
                      checked={interviewForm.speakerIsInterviewer}
                      onCheckedChange={(checked) =>
                        setInterviewForm({
                          ...interviewForm,
                          speakerIsInterviewer: checked === true,
                        })
                      }
                    />
                    <Label
                      htmlFor="first-speaker-interviewer"
                      className="text-sm font-normal"
                    >
                      Es entrevistador
                    </Label>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
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
