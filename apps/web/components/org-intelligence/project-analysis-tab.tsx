"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EntityTypeBadge } from "@/components/org-intelligence/entity-type-badge";
import { ConfidenceBadge } from "@/components/org-intelligence/confidence-badge";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";

interface Problem {
  id: string;
  description: string;
  severity: string;
  confidence: number;
  status: string;
  _count?: {
    affectedEntities?: number;
  };
  affectedEntities?: { id: string }[];
}

interface Entity {
  id: string;
  name: string;
  type: string;
  confidence: number;
  status: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number };
}

const severityConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  CRITICAL: { label: "Critico", color: "text-red-700", bgColor: "bg-red-500" },
  HIGH: { label: "Alto", color: "text-orange-700", bgColor: "bg-orange-500" },
  MEDIUM: {
    label: "Medio",
    color: "text-yellow-700",
    bgColor: "bg-yellow-500",
  },
  LOW: { label: "Bajo", color: "text-gray-600", bgColor: "bg-gray-400" },
};

function SeverityBadge({ severity }: { severity: string }) {
  const config = severityConfig[severity] || {
    label: severity,
    color: "text-gray-600",
    bgColor: "bg-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.color} ${config.bgColor.replace("bg-", "bg-").replace("500", "100").replace("400", "100")}`}
    >
      {config.label}
    </span>
  );
}

export function ProjectAnalysisTab({ projectId }: { projectId: string }) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const [problemsRes, entitiesRes] = await Promise.all([
        api
          .get<PaginatedResponse<Problem> | Problem[]>(
            `/org-intelligence/problems?projectId=${projectId}`,
          )
          .catch(() => null),
        api
          .get<PaginatedResponse<Entity> | Entity[]>(
            `/org-intelligence/entities?projectId=${projectId}`,
          )
          .catch(() => null),
      ]);

      if (problemsRes) {
        const p = Array.isArray(problemsRes)
          ? problemsRes
          : (problemsRes as PaginatedResponse<Problem>).data ?? [];
        setProblems(p);
      }
      if (entitiesRes) {
        const e = Array.isArray(entitiesRes)
          ? entitiesRes
          : (entitiesRes as PaginatedResponse<Entity>).data ?? [];
        setEntities(e);
      }
      if (!problemsRes && !entitiesRes) {
        setError(true);
      }
    } catch {
      setError(true);
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
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="py-4">
                <Skeleton className="mb-2 h-4 w-1/2" />
                <Skeleton className="h-8 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || ((problems?.length ?? 0) === 0 && (entities?.length ?? 0) === 0)) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Los datos de analisis estaran disponibles una vez procesadas las
            entrevistas.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Compute stats
  const totalEntities = entities.length;
  const totalProblems = problems.length;
  const totalProcesses = entities.filter((e) => e.type === "PROCESS").length;
  const avgConfidence =
    entities.length > 0
      ? entities.reduce((sum, e) => sum + (e.confidence || 0), 0) /
        entities.length
      : 0;

  // Problems by severity
  const severityCounts: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  problems.forEach((p) => {
    if (severityCounts[p.severity] !== undefined) {
      severityCounts[p.severity]++;
    }
  });
  const maxSeverityCount = Math.max(...Object.values(severityCounts), 1);

  // Top 5 problems (sort by severity priority then confidence)
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  const topProblems = [...problems]
    .sort((a, b) => {
      const sa = severityOrder[a.severity] ?? 4;
      const sb = severityOrder[b.severity] ?? 4;
      if (sa !== sb) return sa - sb;
      return (b.confidence || 0) - (a.confidence || 0);
    })
    .slice(0, 5);

  // Entity type distribution
  const entityTypeCounts: Record<string, number> = {};
  entities.forEach((e) => {
    entityTypeCounts[e.type] = (entityTypeCounts[e.type] || 0) + 1;
  });
  const entityTypeEntries = Object.entries(entityTypeCounts).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Total entidades</p>
              <HelpTooltip text="Personas, roles, departamentos, procesos, sistemas y otros elementos identificados en las entrevistas." />
            </div>
            <p className="mt-1 text-2xl font-bold">{totalEntities}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Total problemas</p>
              <HelpTooltip text="Ineficiencias, cuellos de botella, riesgos y quejas detectados por la IA en las entrevistas." />
            </div>
            <p className="mt-1 text-2xl font-bold">{totalProblems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">Total procesos</p>
              <HelpTooltip text="Procesos de negocio identificados con sus actividades, responsables y flujos." />
            </div>
            <p className="mt-1 text-2xl font-bold">{totalProcesses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-1">
              <p className="text-xs text-muted-foreground">
                Confianza promedio
              </p>
              <HelpTooltip text="Promedio de certeza de la IA sobre la informacion extraida. Mayor a 80% es alta confianza." />
            </div>
            <p className="mt-1 text-2xl font-bold">
              {Math.round(avgConfidence * 100)}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Problems by severity */}
      {totalProblems > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Problemas por severidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map(
              (severity) => {
                const count = severityCounts[severity];
                const config = severityConfig[severity];
                const widthPct = (count / maxSeverityCount) * 100;
                return (
                  <div key={severity} className="flex items-center gap-3">
                    <span className="w-16 text-xs font-medium text-muted-foreground">
                      {config.label}
                    </span>
                    <div className="flex-1">
                      <div className="h-5 w-full rounded bg-muted">
                        <div
                          className={`h-5 rounded ${config.bgColor}`}
                          style={{
                            width: `${widthPct}%`,
                            minWidth: count > 0 ? "1.5rem" : 0,
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-xs font-medium">
                      {count}
                    </span>
                  </div>
                );
              },
            )}
          </CardContent>
        </Card>
      )}

      {/* Top 5 problems */}
      {topProblems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Top 5 problemas
              <HelpTooltip text="Los problemas se ordenan por severidad y confianza. Severidad: Critico (operacion detenida), Alto (impacto significativo), Medio (ineficiencia), Bajo (mejora menor)." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Table header */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
                <span>Severidad</span>
                <span>Descripcion</span>
                <span>Entidades</span>
                <span>Confianza</span>
              </div>
              {topProblems.map((problem) => {
                const affectedCount =
                  problem._count?.affectedEntities ??
                  problem.affectedEntities?.length ??
                  0;
                return (
                  <div
                    key={problem.id}
                    className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 text-xs"
                  >
                    <SeverityBadge severity={problem.severity} />
                    <span className="truncate" title={problem.description}>
                      {problem.description}
                    </span>
                    <span className="text-center text-muted-foreground">
                      {affectedCount}
                    </span>
                    <ConfidenceBadge confidence={problem.confidence || 0} />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entity type distribution */}
      {entityTypeEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribucion por tipo de entidad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {entityTypeEntries.map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5"
                >
                  <EntityTypeBadge type={type} />
                  <span className="text-sm font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
