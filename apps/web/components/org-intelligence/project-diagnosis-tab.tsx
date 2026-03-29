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
import { Badge } from "@/components/ui/badge";
import { EntityTypeBadge } from "@/components/org-intelligence/entity-type-badge";
import { StatusBadge } from "@/components/org-intelligence/status-badge";

interface DiagnosisSummary {
  executiveSummary?: string;
  bottlenecks?: Bottleneck[];
  spofs?: Spof[];
  contradictions?: Contradiction[];
}

interface Bottleneck {
  id: string;
  name: string;
  type: string;
  dependencyCount: number;
}

interface Spof {
  id: string;
  name: string;
  type: string;
  processCount: number;
}

interface Contradiction {
  id: string;
  description: string;
  type: string;
  status: string;
  interviewA?: string;
  interviewB?: string;
}

interface Entity {
  id: string;
  name: string;
  type: string;
  confidence: number;
  status: string;
  _count?: {
    relationsFrom?: number;
    relationsTo?: number;
  };
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number };
}

export function ProjectDiagnosisTab({ projectId }: { projectId: string }) {
  const [diagnosis, setDiagnosis] = useState<DiagnosisSummary | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      let gotData = false;

      // Try fetching diagnosis endpoint
      const diagnosisRes = await api
        .get<DiagnosisSummary>(
          `/org-intelligence/diagnosis?projectId=${projectId}`,
        )
        .catch(() => null);

      if (diagnosisRes) {
        setDiagnosis(diagnosisRes);
        gotData = true;
      }

      // Also fetch entities for bottleneck/SPOF analysis if diagnosis endpoint doesn't provide them
      const entitiesRes = await api
        .get<PaginatedResponse<Entity> | Entity[]>(
          `/org-intelligence/entities?projectId=${projectId}`,
        )
        .catch(() => null);

      if (entitiesRes) {
        const entList = Array.isArray(entitiesRes)
          ? entitiesRes
          : entitiesRes.data;
        setEntities(entList);
        if (entList.length > 0) gotData = true;
      }

      setHasData(gotData);
    } catch {
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (!hasData) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            El diagnostico estara disponible una vez procesadas las entrevistas.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aqui se mostraran cuellos de botella, puntos unicos de falla y
            contradicciones detectadas entre entrevistas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Derive bottlenecks from entities if not provided by diagnosis API
  const bottlenecks: Bottleneck[] =
    diagnosis?.bottlenecks ??
    entities
      .filter((e) => {
        const depCount =
          (e._count?.relationsFrom ?? 0) + (e._count?.relationsTo ?? 0);
        return depCount > 2;
      })
      .map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        dependencyCount:
          (e._count?.relationsFrom ?? 0) + (e._count?.relationsTo ?? 0),
      }))
      .sort((a, b) => b.dependencyCount - a.dependencyCount)
      .slice(0, 10);

  // Derive SPOFs from entities if not provided
  const spofs: Spof[] =
    diagnosis?.spofs ??
    entities
      .filter(
        (e) =>
          e.type === "ROLE" && (e._count?.relationsFrom ?? 0) + (e._count?.relationsTo ?? 0) > 2,
      )
      .map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        processCount:
          (e._count?.relationsFrom ?? 0) + (e._count?.relationsTo ?? 0),
      }))
      .sort((a, b) => b.processCount - a.processCount)
      .slice(0, 10);

  const contradictions: Contradiction[] = diagnosis?.contradictions ?? [];

  return (
    <div className="space-y-6">
      {/* Executive summary */}
      {diagnosis?.executiveSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen ejecutivo</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {diagnosis.executiveSummary}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Bottlenecks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">&#9888;</span>
              Cuellos de botella
            </CardTitle>
            <CardDescription>
              Entidades con alto numero de dependencias
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bottlenecks.length > 0 ? (
              <div className="space-y-2">
                {bottlenecks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <EntityTypeBadge type={b.type} />
                      <span className="text-sm font-medium">{b.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {b.dependencyCount} dependencias
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No se detectaron cuellos de botella significativos.
              </p>
            )}
          </CardContent>
        </Card>

        {/* SPOFs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="text-lg">&#9888;</span>
              Puntos unicos de falla
            </CardTitle>
            <CardDescription>
              Roles que participan en multiples procesos
            </CardDescription>
          </CardHeader>
          <CardContent>
            {spofs.length > 0 ? (
              <div className="space-y-2">
                {spofs.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <EntityTypeBadge type={s.type} />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {s.processCount} procesos
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No se detectaron puntos unicos de falla.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Contradictions */}
      <Card>
        <CardHeader>
          <CardTitle>Contradicciones</CardTitle>
          <CardDescription>
            Afirmaciones conflictivas detectadas entre entrevistas
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contradictions.length > 0 ? (
            <div className="space-y-3">
              {contradictions.map((c) => (
                <div key={c.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <StatusBadge type="conflict" value={c.type} />
                    <Badge variant="outline" className="text-xs">
                      {c.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.description}
                  </p>
                  {(c.interviewA || c.interviewB) && (
                    <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                      {c.interviewA && <span>Entrevista A: {c.interviewA}</span>}
                      {c.interviewB && <span>Entrevista B: {c.interviewB}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No se han detectado contradicciones entre entrevistas.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
