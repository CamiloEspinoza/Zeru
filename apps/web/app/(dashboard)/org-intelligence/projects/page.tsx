"use client";

import { useEffect, useState, useCallback } from "react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  _count?: {
    interviews: number;
    entities: number;
    problems: number;
  };
}

interface ProjectsResponse {
  data: Project[];
  meta: { total: number; page: number; perPage: number };
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
  });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<ProjectsResponse>(
        "/org-intelligence/projects",
      );
      setProjects(res.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      setCreating(true);
      await api.post("/org-intelligence/projects", {
        name: form.name,
        description: form.description || undefined,
        startDate: form.startDate ? new Date(form.startDate + "T12:00:00").toISOString() : undefined,
      });
      setDialogOpen(false);
      setForm({ name: "", description: "", startDate: "" });
      await fetchProjects();
    } catch {
      // silently fail
    } finally {
      setCreating(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground mt-1">
            Cada proyecto agrupa las entrevistas y el análisis de una iniciativa de mejora continua. Crea un proyecto, agenda entrevistas, sube los audios y deja que la IA extraiga conocimiento organizacional.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setDialogOpen(true)}>Nuevo Proyecto</Button>
          <HelpTooltip text="Crea un proyecto para iniciar un levantamiento organizacional. Después podrás agregar entrevistas y analizar los resultados." />
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-3 w-1/3" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              No hay proyectos todavía. Crea tu primer proyecto para comenzar.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              Crear Proyecto
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() =>
                router.push(`/org-intelligence/projects/${project.id}`)
              }
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm font-semibold">
                    {project.name}
                  </CardTitle>
                  <StatusBadge type="project" value={project.status} />
                </div>
                {project.description && (
                  <CardDescription className="line-clamp-2">
                    {project.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {project._count && (
                    <>
                      <span>
                        {project._count.interviews}{" "}
                        {project._count.interviews === 1
                          ? "entrevista"
                          : "entrevistas"}
                      </span>
                      <span>
                        {project._count.entities}{" "}
                        {project._count.entities === 1
                          ? "entidad"
                          : "entidades"}
                      </span>
                      <span>
                        {project._count.problems}{" "}
                        {project._count.problems === 1
                          ? "problema"
                          : "problemas"}
                      </span>
                    </>
                  )}
                </div>
              </CardContent>
              <CardFooter>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {project.startDate && (
                    <span>Inicio: {formatDate(project.startDate)}</span>
                  )}
                  <span>Creado: {formatDate(project.createdAt)}</span>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Proyecto</DialogTitle>
            <DialogDescription>
              Crea un nuevo proyecto de inteligencia organizacional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Nombre del proyecto"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                placeholder="Describe el objetivo del proyecto"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Fecha de inicio</Label>
              <Input
                id="startDate"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
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
            <Button
              onClick={handleCreate}
              disabled={!form.name.trim() || creating}
            >
              {creating ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
