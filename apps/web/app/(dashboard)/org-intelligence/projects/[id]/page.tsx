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
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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

interface Interview {
  id: string;
  title: string | null;
  date: string | null;
  status: string;
  speakers: unknown;
  createdAt: string;
  _count?: {
    speakers: number;
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

  const [project, setProject] = useState<Project | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loadingProject, setLoadingProject] = useState(true);
  const [loadingInterviews, setLoadingInterviews] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [interviewForm, setInterviewForm] = useState({
    title: "",
    date: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [saving, setSaving] = useState(false);

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
      await api.post("/org-intelligence/interviews", {
        projectId: id,
        title: interviewForm.title || undefined,
        interviewDate: interviewForm.date
          ? new Date(interviewForm.date + "T12:00:00").toISOString()
          : undefined,
      });
      setDialogOpen(false);
      setInterviewForm({ title: "", date: "" });
      await fetchInterviews();
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
        <Button
          variant="outline"
          onClick={() => router.push("/org-intelligence/projects")}
        >
          Volver
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="interviews">
        <TabsList>
          <TabsTrigger value="interviews" className="gap-1">
            Entrevistas
            <HelpTooltip text="Gestiona las entrevistas del proyecto. Sube audio, configura participantes y lanza el procesamiento con IA." />
          </TabsTrigger>
          <TabsTrigger value="analysis" className="gap-1">
            Análisis
            <HelpTooltip text="Análisis cruzado de todas las entrevistas. Muestra entidades extraídas, problemas detectados y estadísticas generales." />
          </TabsTrigger>
          <TabsTrigger value="diagnosis" className="gap-1">
            Diagnóstico
            <HelpTooltip text="Diagnóstico organizacional automatizado. Detecta cuellos de botella, puntos únicos de fallo (SPOF) y contradicciones entre entrevistados." />
          </TabsTrigger>
          <TabsTrigger value="action-plan" className="gap-1">
            Plan de Acción
            <HelpTooltip text="Propuestas de mejora priorizadas con framework RICE (Reach, Impact, Confidence, Effort). Incluye matriz esfuerzo-impacto." />
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-1">
            Configuración
            <HelpTooltip text="Edita los datos generales del proyecto: nombre, descripción y fechas." />
          </TabsTrigger>
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
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  No hay entrevistas todavía. Agrega tu primera entrevista.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => setDialogOpen(true)}
                >
                  Crear Entrevista
                </Button>
              </CardContent>
            </Card>
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
                      <StatusBadge type="processing" value={interview.status} />
                    </div>
                    <CardDescription>
                      {formatDate(interview.date ?? interview.createdAt)}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter>
                    <div className="text-xs text-muted-foreground">
                      {interview._count?.speakers != null && (
                        <span>
                          {interview._count.speakers}{" "}
                          {interview._count.speakers === 1
                            ? "participante"
                            : "participantes"}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Entrevista</DialogTitle>
            <DialogDescription>
              Agrega una nueva entrevista al proyecto.
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
    </div>
  );
}
