"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntitiesTab } from "@/components/org-intelligence/knowledge-base/entities-tab";
import { SearchTab } from "@/components/org-intelligence/knowledge-base/search-tab";
import { ProcessesTab } from "@/components/org-intelligence/knowledge-base/processes-tab";

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface ProjectsResponse {
  data: Project[];
  meta: { total: number; page: number; perPage: number };
}

export default function KnowledgeBasePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const fetchProjects = useCallback(async () => {
    try {
      setLoadingProjects(true);
      const res = await api.get<ProjectsResponse>(
        "/org-intelligence/projects",
      );
      setProjects(res.data);
    } catch (err) {
      console.error("Error al cargar proyectos:", err);
    } finally {
      setLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Base de Conocimiento</h1>
        <p className="text-muted-foreground mt-1">
          Explora todo el conocimiento extraído de las entrevistas. Busca entidades, relaciones y
          procesos organizacionales.
        </p>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Proyecto:</span>
        {loadingProjects ? (
          <Skeleton className="h-7 w-48" />
        ) : projects.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            No hay proyectos disponibles
          </span>
        ) : (
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Selecciona un proyecto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!selectedProjectId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Selecciona un proyecto para explorar su base de conocimiento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="entities">
          <TabsList>
            <TabsTrigger value="entities">Entidades</TabsTrigger>
            <TabsTrigger value="search">Búsqueda</TabsTrigger>
            <TabsTrigger value="processes">Procesos</TabsTrigger>
          </TabsList>

          <TabsContent value="entities" className="pt-4">
            <EntitiesTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="search" className="pt-4">
            <SearchTab projectId={selectedProjectId} />
          </TabsContent>

          <TabsContent value="processes" className="pt-4">
            <ProcessesTab projectId={selectedProjectId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
