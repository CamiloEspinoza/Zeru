"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell,
} from "recharts";

interface Improvement {
  id: string;
  title: string;
  description?: string;
  type?: string;
  problemDescription?: string;
  priority?: number;
  effort?: number;
  impact?: number;
  status: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; perPage: number };
}

const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  PROPOSED: {
    label: "Propuesto",
    color: "text-gray-700",
    bgColor: "bg-gray-100",
    dotColor: "#9ca3af",
  },
  VALIDATED: {
    label: "Validado",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    dotColor: "#3b82f6",
  },
  IN_PROGRESS: {
    label: "En progreso",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
    dotColor: "#f59e0b",
  },
  COMPLETED: {
    label: "Completado",
    color: "text-green-700",
    bgColor: "bg-green-100",
    dotColor: "#22c55e",
  },
};

const typeLabels: Record<string, string> = {
  PROCESS: "Proceso",
  TECHNOLOGY: "Tecnologia",
  PEOPLE: "Personas",
  ORGANIZATION: "Organizacion",
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || {
    label: status,
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      {config.label}
    </span>
  );
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: Improvement }[];
}

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-md border bg-background p-2 shadow-sm">
      <p className="text-sm font-medium">{item.title}</p>
      <p className="text-xs text-muted-foreground">
        Esfuerzo: {item.effort} | Impacto: {item.impact}
      </p>
      <StatusBadge status={item.status} />
    </div>
  );
}

export function ProjectImprovementsTab({
  projectId,
}: {
  projectId: string;
}) {
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await api
        .get<PaginatedResponse<Improvement> | Improvement[]>(
          `/org-intelligence/improvements?projectId=${projectId}`,
        )
        .catch(() => null);

      if (res) {
        setImprovements(Array.isArray(res) ? res : res.data);
      } else {
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
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || improvements.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Las mejoras se generaran automaticamente tras el analisis. Tambien
            puedes crear mejoras manualmente.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare scatter data — only items that have both effort and impact
  const scatterData = improvements.filter(
    (i) => i.effort != null && i.impact != null,
  );

  return (
    <div className="space-y-6">
      {/* Improvements table */}
      <Card>
        <CardHeader>
          <CardTitle>Mejoras identificadas ({improvements.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 border-b pb-2 text-xs font-medium text-muted-foreground">
              <span>Titulo</span>
              <span>Tipo</span>
              <span>Prioridad</span>
              <span>Esfuerzo</span>
              <span>Impacto</span>
              <span>Estado</span>
            </div>
            {improvements.map((improvement) => (
              <div
                key={improvement.id}
                className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-3 text-xs"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium" title={improvement.title}>
                    {improvement.title}
                  </p>
                  {improvement.problemDescription && (
                    <p
                      className="truncate text-muted-foreground"
                      title={improvement.problemDescription}
                    >
                      {improvement.problemDescription}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {typeLabels[improvement.type ?? ""] ?? improvement.type ?? "-"}
                </Badge>
                <span className="text-center">
                  {improvement.priority ?? "-"}
                </span>
                <span className="text-center">
                  {improvement.effort ?? "-"}
                </span>
                <span className="text-center">
                  {improvement.impact ?? "-"}
                </span>
                <StatusBadge status={improvement.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Effort-Impact Matrix */}
      {scatterData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Matriz Esfuerzo-Impacto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Quadrant labels */}
              <div className="pointer-events-none absolute inset-0 z-10 flex">
                <div className="flex w-1/2 flex-col">
                  <div className="flex flex-1 items-start justify-start p-4">
                    <span className="rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-600">
                      Quick Wins
                    </span>
                  </div>
                  <div className="flex flex-1 items-end justify-start p-4">
                    <span className="rounded bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500">
                      Si hay tiempo
                    </span>
                  </div>
                </div>
                <div className="flex w-1/2 flex-col">
                  <div className="flex flex-1 items-start justify-end p-4">
                    <span className="rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-600">
                      Estrategico
                    </span>
                  </div>
                  <div className="flex flex-1 items-end justify-end p-4">
                    <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-500">
                      Evitar
                    </span>
                  </div>
                </div>
              </div>

              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart
                  margin={{ top: 20, right: 20, bottom: 30, left: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    dataKey="effort"
                    name="Esfuerzo"
                    domain={[0, 10]}
                    tickCount={6}
                  >
                    <Label value="Esfuerzo &#8594;" position="bottom" offset={10} />
                  </XAxis>
                  <YAxis
                    type="number"
                    dataKey="impact"
                    name="Impacto"
                    domain={[0, 10]}
                    tickCount={6}
                  >
                    <Label
                      value="Impacto &#8594;"
                      angle={-90}
                      position="left"
                      offset={0}
                    />
                  </YAxis>
                  <ReferenceLine x={5} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <ReferenceLine y={5} stroke="#e5e7eb" strokeDasharray="4 4" />
                  <Tooltip
                    content={<ChartTooltip />}
                    cursor={{ strokeDasharray: "3 3" }}
                  />
                  <Scatter name="Mejoras" data={scatterData}>
                    {scatterData.map((item) => (
                      <Cell
                        key={item.id}
                        fill={
                          statusConfig[item.status]?.dotColor ?? "#6366f1"
                        }
                      />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {Object.entries(statusConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5 text-xs">
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: config.dotColor }}
                  />
                  <span className="text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
