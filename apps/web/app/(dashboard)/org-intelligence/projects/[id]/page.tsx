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

const projectStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  ACTIVE: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  ARCHIVED: "bg-slate-100 text-slate-800",
};

const projectStatusLabels: Record<string, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

const interviewStatusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-800",
  UPLOADED: "bg-yellow-100 text-yellow-800",
  TRANSCRIBING: "bg-blue-100 text-blue-800",
  EXTRACTING: "bg-purple-100 text-purple-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
};

const interviewStatusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  UPLOADED: "Subido",
  TRANSCRIBING: "Transcribiendo",
  EXTRACTING: "Extrayendo",
  COMPLETED: "Completado",
  FAILED: "Fallido",
};

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
        date: interviewForm.date || undefined,
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
        startDate: editForm.startDate || undefined,
        endDate: editForm.endDate || undefined,
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
            <Badge
              variant="outline"
              className={projectStatusColors[project.status] ?? ""}
            >
              {projectStatusLabels[project.status] ?? project.status}
            </Badge>
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
          <TabsTrigger value="interviews">Entrevistas</TabsTrigger>
          <TabsTrigger value="analysis">Analisis</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnostico</TabsTrigger>
          <TabsTrigger value="action-plan">Plan de Accion</TabsTrigger>
          <TabsTrigger value="settings">Configuracion</TabsTrigger>
        </TabsList>

        {/* Entrevistas Tab */}
        <TabsContent value="interviews" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Entrevistas ({interviews.length})
            </h2>
            <Button onClick={() => setDialogOpen(true)}>
              Nueva Entrevista
            </Button>
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
                  No hay entrevistas todavia. Agrega tu primera entrevista.
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
                        {interview.title ?? "Entrevista sin titulo"}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={
                          interviewStatusColors[interview.status] ?? ""
                        }
                      >
                        {interviewStatusLabels[interview.status] ??
                          interview.status}
                      </Badge>
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

        {/* Analisis Tab */}
        <TabsContent value="analysis" className="pt-4">
          <ProjectAnalysisTab projectId={id} />
        </TabsContent>

        {/* Diagnostico Tab */}
        <TabsContent value="diagnosis" className="pt-4">
          <ProjectDiagnosisTab projectId={id} />
        </TabsContent>

        {/* Plan de Accion Tab */}
        <TabsContent value="action-plan" className="pt-4">
          <ProjectImprovementsTab projectId={id} />
        </TabsContent>

        {/* Configuracion Tab */}
        <TabsContent value="settings" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuracion del Proyecto</CardTitle>
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
                <Label htmlFor="edit-description">Descripcion</Label>
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
              <Label htmlFor="interview-title">Titulo</Label>
              <Input
                id="interview-title"
                placeholder="Titulo de la entrevista"
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
