"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityTypeBadge } from "@/components/org-intelligence/entity-type-badge";
import { MermaidDiagram } from "@/components/org-intelligence/mermaid-diagram";

interface Entity {
  id: string;
  type: string;
  name: string;
  description: string | null;
  confidence: number;
  aliases: string[];
  metadata: Record<string, unknown> | null;
  relations?: EntityRelation[];
}

interface EntityRelation {
  id: string;
  type: string;
  targetEntity: { id: string; name: string; type: string };
}

interface EntitiesResponse {
  data: Entity[];
  meta: { total: number; page: number; perPage: number };
}

function generateMermaidChart(process: Entity, acts: Entity[]): string | null {
  if (acts.length === 0) return null;

  const lines = ["flowchart TD"];
  acts.forEach((act, i) => {
    const nodeId = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : "");
    const label = act.name.replace(/"/g, "'");
    lines.push(`    ${nodeId}["${label}"]`);
  });

  for (let i = 0; i < acts.length - 1; i++) {
    const fromId = String.fromCharCode(65 + (i % 26)) + (i >= 26 ? i : "");
    const toId =
      String.fromCharCode(65 + ((i + 1) % 26)) + (i + 1 >= 26 ? i + 1 : "");
    lines.push(`    ${fromId} --> ${toId}`);
  }

  return lines.join("\n");
}

export function ProcessesTab({ projectId }: { projectId: string }) {
  const [processes, setProcesses] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProcess, setSelectedProcess] = useState<Entity | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activities, setActivities] = useState<Entity[]>([]);

  const fetchProcesses = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<EntitiesResponse>(
        `/org-intelligence/entities?projectId=${projectId}&type=PROCESS&perPage=50`,
      );
      setProcesses(res.data);
    } catch {
      setProcesses([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProcesses();
  }, [fetchProcesses]);

  const handleProcessClick = async (process: Entity) => {
    setSelectedProcess(process);
    setActivities([]);
    try {
      setLoadingDetail(true);
      const detail = await api.get<Entity>(
        `/org-intelligence/entities/${process.id}`,
      );
      const activityRelations =
        detail.relations?.filter(
          (r) => r.targetEntity.type === "ACTIVITY",
        ) || [];

      if (activityRelations.length > 0) {
        const activityEntities = await Promise.all(
          activityRelations.map(async (rel) => {
            try {
              return await api.get<Entity>(
                `/org-intelligence/entities/${rel.targetEntity.id}`,
              );
            } catch {
              return {
                id: rel.targetEntity.id,
                name: rel.targetEntity.name,
                type: "ACTIVITY",
                description: null,
                confidence: 0,
                aliases: [],
                metadata: null,
              } as Entity;
            }
          }),
        );
        setActivities(activityEntities);
      }
    } catch {
      // keep basic process data
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-3">
              <Skeleton className="h-4 w-48" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (processes.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No se encontraron procesos en este proyecto.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Los diagramas se generan cuando el entrevistado describe un proceso
            paso a paso. Si no ves procesos, puede que las entrevistas aún no
            hayan sido procesadas o que no se hayan descrito procesos
            específicos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Diagramas de flujo generados automáticamente desde las entrevistas. Cada
        proceso muestra sus actividades, responsables y dependencias.
      </p>
      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Procesos</h3>
          {processes.map((process) => (
            <Card
              key={process.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedProcess?.id === process.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => handleProcessClick(process)}
            >
              <CardContent className="py-3">
                <p className="text-sm font-medium">{process.name}</p>
                {process.description && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {process.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          {!selectedProcess ? (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Selecciona un proceso para ver su diagrama.
                </p>
              </CardContent>
            </Card>
          ) : loadingDetail ? (
            <Card>
              <CardContent className="py-10">
                <div className="space-y-3">
                  <Skeleton className="mx-auto h-6 w-48" />
                  <Skeleton className="mx-auto h-40 w-full" />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <EntityTypeBadge type="PROCESS" />
                  {selectedProcess.name}
                </CardTitle>
                {selectedProcess.description && (
                  <CardDescription>
                    {selectedProcess.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {(() => {
                  const chart = generateMermaidChart(
                    selectedProcess,
                    activities,
                  );
                  if (!chart) {
                    return (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No hay actividades definidas para este proceso.
                      </p>
                    );
                  }
                  return (
                    <div className="overflow-auto rounded-md border p-4">
                      <MermaidDiagram chart={chart} />
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
