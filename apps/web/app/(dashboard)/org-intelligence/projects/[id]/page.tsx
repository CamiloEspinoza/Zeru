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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
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
import { ProjectAnalysisTab } from "@/components/org-intelligence/project-analysis-tab";
import { ProjectDiagnosisTab } from "@/components/org-intelligence/project-diagnosis-tab";
import { ProjectImprovementsTab } from "@/components/org-intelligence/project-improvements-tab";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { PersonSearchSelect } from "@/components/org-intelligence/person-search-select";
import { SpeakerList, type SpeakerItem } from "@/components/org-intelligence/speaker-list";
import { InterviewCard } from "@/components/org-intelligence/interview-card";
import { ProjectHeader } from "@/components/org-intelligence/project-header";
import { EditInterviewDialog } from "@/components/org-intelligence/edit-interview-dialog";

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
  objective: string | null;
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

  const [deleteProjectDialogOpen, setDeleteProjectDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [changingStatus, setChangingStatus] = useState(false);

  const [editInterviewDialogOpen, setEditInterviewDialogOpen] = useState(false);
  const [editingInterview, setEditingInterview] = useState<Interview | null>(null);
  const [editInterviewForm, setEditInterviewForm] = useState({ title: "", interviewDate: "", objective: "" });
  const [savingInterview, setSavingInterview] = useState(false);

  const [deleteInterviewDialogOpen, setDeleteInterviewDialogOpen] = useState(false);
  const [deletingInterview, setDeletingInterview] = useState<Interview | null>(null);
  const [deletingInterviewLoading, setDeletingInterviewLoading] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      setLoadingProject(true);
      const res = await api.get<Project>(`/org-intelligence/projects/${id}`);
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
              personEntityId: s.personEntityId || undefined,
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

      if (created?.id) {
        router.push(`/org-intelligence/projects/${id}/interviews/${created.id}`);
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
        startDate: editForm.startDate
          ? new Date(editForm.startDate + "T12:00:00").toISOString()
          : undefined,
        endDate: editForm.endDate
          ? new Date(editForm.endDate + "T12:00:00").toISOString()
          : undefined,
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
      await api.patch(`/org-intelligence/projects/${id}`, { status: newStatus });
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
      interviewDate: interview.interviewDate ? interview.interviewDate.slice(0, 10) : "",
      objective: interview.objective ?? "",
    });
    setEditInterviewDialogOpen(true);
  };

  const handleEditInterview = async () => {
    if (!editingInterview) return;
    try {
      setSavingInterview(true);
      await api.patch(`/org-intelligence/interviews/${editingInterview.id}`, {
        title: editInterviewForm.title || undefined,
        interviewDate: editInterviewForm.interviewDate || undefined,
        objective: editInterviewForm.objective || undefined,
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
      <ProjectHeader
        project={project}
        onChangeStatus={handleChangeStatus}
        onDelete={() => setDeleteProjectDialogOpen(true)}
        changingStatus={changingStatus}
      />

      <Tabs defaultValue={initialTab}>
        <div className="flex items-center gap-2">
          <TabsList>
            <TabsTrigger value="interviews">
              Entrevistas{interviews.length > 0 ? ` (${interviews.length})` : ""}
            </TabsTrigger>
            <TabsTrigger value="analysis">
              Análisis
              {(project._count?.entities ?? 0) > 0 ? (
                ` (${project._count?.entities ?? 0})`
              ) : (
                <span className="ml-1 opacity-60">(pendiente)</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="diagnosis">
              Diagnóstico
              {(project._count?.problems ?? 0) > 0 ? (
                ` (${project._count?.problems ?? 0})`
              ) : (
                <span className="ml-1 opacity-60">(pendiente)</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="action-plan">Plan de Acción</TabsTrigger>
            <TabsTrigger value="settings">Configuración</TabsTrigger>
          </TabsList>
          <HelpTooltip
            iconSize="md"
            text={
              <div className="space-y-2 py-1">
                <p>
                  <strong>Entrevistas:</strong> Gestiona entrevistas, sube audio
                  y lanza el procesamiento con IA.
                </p>
                <p>
                  <strong>Análisis:</strong> Análisis cruzado con entidades
                  extraídas, problemas detectados y estadísticas generales.
                </p>
                <p>
                  <strong>Diagnóstico:</strong> Detecta cuellos de botella,
                  puntos únicos de fallo y contradicciones entre entrevistados.
                </p>
                <p>
                  <strong>Plan de Acción:</strong> Mejoras priorizadas con
                  framework RICE y matriz esfuerzo-impacto.
                </p>
                <p>
                  <strong>Configuración:</strong> Edita nombre, descripción y
                  fechas del proyecto.
                </p>
              </div>
            }
          />
        </div>

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
                Agrega una entrevista. Después podrás subir el audio para que
                sea procesado automáticamente.
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
                <svg
                  className="size-8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 18.5a6.5 6.5 0 100-13 6.5 6.5 0 000 13z" />
                  <path d="M12 8v4l2.5 2.5" />
                  <path d="M19.5 4.5l-2 2M4.5 4.5l2 2" />
                </svg>
              }
              title="Agrega tu primera entrevista"
              description="Cada entrevista es una conversación grabada con un coordinador de área. Configura los participantes, sube el audio y la IA extraerá roles, procesos, problemas y dependencias automáticamente."
              action={{
                label: "Crear entrevista",
                onClick: () => setDialogOpen(true),
              }}
              tip="Tip: Entrevistas de 60-90 minutos dan los mejores resultados. Asegúrate de que el audio tenga buena calidad."
            />
          ) : (
            <div className="space-y-3">
              {interviews.map((interview) => (
                <InterviewCard
                  key={interview.id}
                  interview={interview}
                  projectId={id}
                  onEdit={openEditInterviewDialog}
                  onDelete={openDeleteInterviewDialog}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="analysis" className="pt-4">
          <ProjectAnalysisTab projectId={id} />
        </TabsContent>

        <TabsContent value="diagnosis" className="pt-4">
          <ProjectDiagnosisTab projectId={id} />
        </TabsContent>

        <TabsContent value="action-plan" className="pt-4">
          <ProjectImprovementsTab projectId={id} />
        </TabsContent>

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
                    setEditForm({ ...editForm, description: e.target.value })
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
                      setEditForm({ ...editForm, startDate: e.target.value })
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
                      setEditForm({ ...editForm, endDate: e.target.value })
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
              Agrega una nueva entrevista al proyecto. Puedes agregar
              participantes desde el directorio o manualmente.
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
                  setInterviewForm({ ...interviewForm, title: e.target.value })
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
                  setInterviewForm({ ...interviewForm, date: e.target.value })
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
                        Área
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
      <Dialog
        open={deleteProjectDialogOpen}
        onOpenChange={setDeleteProjectDialogOpen}
      >
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

      <EditInterviewDialog
        open={editInterviewDialogOpen}
        onOpenChange={setEditInterviewDialogOpen}
        title={editInterviewForm.title}
        onTitleChange={(t) => setEditInterviewForm((prev) => ({ ...prev, title: t }))}
        interviewDate={editInterviewForm.interviewDate}
        onDateChange={(d) => setEditInterviewForm((prev) => ({ ...prev, interviewDate: d }))}
        objective={editInterviewForm.objective}
        onObjectiveChange={(o) => setEditInterviewForm((prev) => ({ ...prev, objective: o }))}
        onSave={handleEditInterview}
        saving={savingInterview}
      />

      {/* Delete Interview Confirmation Dialog */}
      <Dialog
        open={deleteInterviewDialogOpen}
        onOpenChange={setDeleteInterviewDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Eliminar entrevista?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminará la entrevista
              &quot;{deletingInterview?.title ?? "Sin título"}&quot; y todos sus
              datos asociados.
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
