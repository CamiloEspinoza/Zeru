"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { usePermissions } from "@/hooks/use-permissions";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ── Constants ──

const PIPELINE_STAGES = [
  "REGISTERED",
  "IN_TRANSIT",
  "RECEIVED_STATUS",
  "PROCESSING_STATUS",
  "REPORTING",
  "PRE_VALIDATED",
  "VALIDATED_REPORT",
  "SIGNED",
] as const;

const STAGE_LABELS: Record<string, string> = {
  REGISTERED: "Registrado",
  IN_TRANSIT: "En Tránsito",
  RECEIVED_STATUS: "Recibido",
  PROCESSING_STATUS: "Procesamiento",
  REPORTING: "Con Patólogo",
  PRE_VALIDATED: "Pre-validado",
  VALIDATED_REPORT: "Validado",
  SIGNED: "Firmado",
  DELIVERED: "Entregado",
  DOWNLOADED: "Descargado",
  CANCELLED_REPORT: "Anulado",
  AMENDED: "Enmendado",
};

const CATEGORY_COLORS: Record<string, string> = {
  BIOPSY: "hsl(221, 83%, 53%)",
  PAP: "hsl(160, 84%, 39%)",
  CYTOLOGY: "hsl(271, 91%, 65%)",
  IMMUNOHISTOCHEMISTRY: "hsl(25, 95%, 53%)",
  MOLECULAR: "hsl(46, 97%, 65%)",
  OTHER_EXAM: "hsl(346, 77%, 50%)",
};

const CATEGORY_LABELS: Record<string, string> = {
  BIOPSY: "Biopsias",
  PAP: "PAP",
  CYTOLOGY: "Citología",
  IMMUNOHISTOCHEMISTRY: "IHQ",
  MOLECULAR: "Molecular",
  OTHER_EXAM: "Otros",
};

// ── Types ──

interface StatusCategoryItem {
  status: string;
  category: string;
  count: number;
}

interface TodayVsYesterday {
  received: { today: number; yesterday: number; dayBefore: number };
  validated: { today: number; yesterday: number };
  delivered: { today: number; yesterday: number };
}

interface Alerts {
  urgentActive: number;
  criticalUnnotified: number;
  inProgress: number;
}

interface StatusSummaryResponse {
  byStatusAndCategory: StatusCategoryItem[];
  todayVsYesterday: TodayVsYesterday;
  alerts: Alerts;
  generatedAt: string;
}

interface VolumeTrendItem {
  period: string;
  category: string;
  received: number;
  completed: number;
}

interface VolumeTrendsResponse {
  series: VolumeTrendItem[];
  generatedAt: string;
}

interface TatByCategory {
  category: string;
  avgHours: number;
  medianHours: number;
  p90Hours: number;
}

interface TatByStage {
  eventType: string;
  avgHoursFromReception: number;
}

interface TurnaroundResponse {
  byCategory: TatByCategory[];
  byStage: TatByStage[];
  generatedAt: string;
}

interface FinancialChargeByStatus {
  status: string;
  count: number;
  totalAmount: number;
}

interface FinancialTopOrigin {
  originCode: string;
  totalAmount: number;
  chargeCount: number;
}

interface LiquidationSummary {
  status: string;
  count: number;
  totalAmount: number;
}

interface FinancialSummaryResponse {
  charges: {
    byStatus: FinancialChargeByStatus[];
    grandTotal: number;
    grandCount: number;
  };
  topOrigins: FinancialTopOrigin[];
  liquidations: LiquidationSummary[];
  generatedAt: string;
}

// ── Date range helper ──

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  now.setSeconds(0, 0);
  const toStr = now.toISOString();

  switch (preset) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return { from: from.toISOString(), to: toStr };
    }
    case "week": {
      const dayOfWeek = now.getDay();
      const from = new Date(now);
      from.setDate(from.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      from.setHours(0, 0, 0, 0);
      return { from: from.toISOString(), to: toStr };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: toStr };
    }
    case "prev-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    default:
      return {
        from: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        ).toISOString(),
        to: toStr,
      };
  }
}

function getLast14Days(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 14);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: now.toISOString() };
}

// ── Format helpers ──

function formatCLP(amount: number | undefined | null): string {
  return (amount ?? 0).toLocaleString("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
  });
}

function formatNumber(value: number | undefined | null): string {
  return (value ?? 0).toLocaleString("es-CL");
}

// ── Main Page ──

export default function LaboratoryDashboardPage() {
  const [preset, setPreset] = useState("today");
  const [activeTab, setActiveTab] = useState("operations");

  // Data state
  const [statusSummary, setStatusSummary] =
    useState<StatusSummaryResponse | null>(null);
  const [volumeTrends, setVolumeTrends] =
    useState<VolumeTrendsResponse | null>(null);
  const [turnaround, setTurnaround] = useState<TurnaroundResponse | null>(
    null,
  );
  const [financial, setFinancial] =
    useState<FinancialSummaryResponse | null>(null);

  // Loading state
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingVolume, setLoadingVolume] = useState(true);
  const [loadingTat, setLoadingTat] = useState(true);
  const [loadingFinancial, setLoadingFinancial] = useState(true);

  // Error state
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [errorVolume, setErrorVolume] = useState<string | null>(null);
  const [errorTat, setErrorTat] = useState<string | null>(null);
  const [errorFinancial, setErrorFinancial] = useState<string | null>(null);

  // Permissions
  const { can, loading: permLoading } = usePermissions();
  const canViewFinancial = can("lab", "view-financial");

  // Date params
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- will be used for per-section filtering
  const dateParams = useMemo(() => getDateRange(preset), [preset]);

  // ── Fetchers ──

  const qs = useMemo(
    () => `dateFrom=${dateParams.from}&dateTo=${dateParams.to}`,
    [dateParams],
  );

  const fetchStatusSummary = useCallback(async () => {
    try {
      setLoadingStatus(true);
      const data = await api.get<StatusSummaryResponse>(
        `/lab/dashboard/status-summary`,
      );
      setStatusSummary(data);
      setErrorStatus(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar resumen";
      setErrorStatus(msg);
      toast.error(msg);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchVolumeTrends = useCallback(async () => {
    try {
      setLoadingVolume(true);
      const data = await api.get<VolumeTrendsResponse>(
        `/lab/dashboard/volume-trends?${qs}&granularity=day`,
      );
      setVolumeTrends(data);
      setErrorVolume(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar tendencias";
      setErrorVolume(msg);
      toast.error(msg);
    } finally {
      setLoadingVolume(false);
    }
  }, [qs]);

  const fetchTurnaround = useCallback(async () => {
    try {
      setLoadingTat(true);
      const data = await api.get<TurnaroundResponse>(
        `/lab/dashboard/turnaround?${qs}`,
      );
      setTurnaround(data);
      setErrorTat(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar TAT";
      setErrorTat(msg);
      toast.error(msg);
    } finally {
      setLoadingTat(false);
    }
  }, [qs]);

  const fetchFinancial = useCallback(async () => {
    if (!canViewFinancial) return;
    try {
      setLoadingFinancial(true);
      const data = await api.get<FinancialSummaryResponse>(
        `/lab/dashboard/financial-summary?${qs}`,
      );
      setFinancial(data);
      setErrorFinancial(null);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar financiero";
      setErrorFinancial(msg);
    } finally {
      setLoadingFinancial(false);
    }
  }, [canViewFinancial, qs]);

  const fetchAll = useCallback(() => {
    fetchStatusSummary();
    fetchVolumeTrends();
    fetchTurnaround();
    if (canViewFinancial) fetchFinancial();
  }, [
    fetchStatusSummary,
    fetchVolumeTrends,
    fetchTurnaround,
    fetchFinancial,
    canViewFinancial,
  ]);

  // ── Load on mount + when date changes ──

  useEffect(() => {
    if (permLoading) return;
    fetchAll();
  }, [permLoading, fetchAll]);


  // ── Computed data ──

  const pipelineData = useMemo(() => {
    if (!statusSummary) return [];
    const byStatus: Record<string, number> = {};
    for (const item of statusSummary.byStatusAndCategory) {
      byStatus[item.status] = (byStatus[item.status] || 0) + item.count;
    }
    const total = Object.values(byStatus).reduce((s, v) => s + v, 0);
    return PIPELINE_STAGES.map((stage) => ({
      status: stage,
      label: STAGE_LABELS[stage] || stage,
      count: byStatus[stage] || 0,
      pct: total > 0 ? ((byStatus[stage] || 0) / total) * 100 : 0,
    }));
  }, [statusSummary]);

  const inProcessCount = useMemo(() => {
    if (!statusSummary) return 0;
    const excludeStatuses = new Set(["DELIVERED", "DOWNLOADED", "CANCELLED_REPORT", "AMENDED"]);
    return statusSummary.byStatusAndCategory
      .filter((item) => !excludeStatuses.has(item.status))
      .reduce((sum, item) => sum + item.count, 0);
  }, [statusSummary]);

  const pipelineTableData = useMemo(() => {
    if (!statusSummary) return [];
    const categories = new Set<string>();
    const statusMap: Record<string, Record<string, number>> = {};

    for (const item of statusSummary.byStatusAndCategory) {
      categories.add(item.category);
      if (!statusMap[item.status]) statusMap[item.status] = {};
      statusMap[item.status][item.category] = item.count;
    }

    const catList = Array.from(categories).sort();
    const allStatuses = Object.keys(STAGE_LABELS);

    return allStatuses
      .filter((status) => statusMap[status])
      .map((status) => {
        const row: Record<string, string | number> = {
          status: STAGE_LABELS[status] || status,
        };
        let total = 0;
        for (const cat of catList) {
          const count = statusMap[status]?.[cat] || 0;
          row[cat] = count;
          total += count;
        }
        row.total = total;
        return { row, categories: catList };
      });
  }, [statusSummary]);

  const allCategories = useMemo(() => {
    if (!statusSummary) return [];
    const cats = new Set<string>();
    for (const item of statusSummary.byStatusAndCategory) {
      cats.add(item.category);
    }
    return Array.from(cats).sort();
  }, [statusSummary]);

  // Volume chart data — pivot by period
  const volumeChartData = useMemo(() => {
    if (!volumeTrends?.series?.length) return [];
    const byPeriod: Record<string, Record<string, number>> = {};
    const categories = new Set<string>();

    for (const item of volumeTrends.series) {
      categories.add(item.category);
      if (!byPeriod[item.period]) byPeriod[item.period] = {};
      byPeriod[item.period][item.category] = item.received;
    }

    return Object.entries(byPeriod)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, cats]) => ({
        date: new Date(period).toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "short",
        }),
        ...cats,
      }));
  }, [volumeTrends]);

  const volumeCategories = useMemo(() => {
    if (!volumeTrends?.series?.length) return [];
    return Array.from(new Set(volumeTrends.series.map((s) => s.category)));
  }, [volumeTrends]);

  // TAT chart data
  const tatChartData = useMemo(() => {
    if (!turnaround?.byCategory?.length) return [];
    return turnaround.byCategory.map((item) => ({
      category: CATEGORY_LABELS[item.category] || item.category,
      Promedio: Number(((item.avgHours ?? 0) / 24).toFixed(1)),
      Mediana: Number(((item.medianHours ?? 0) / 24).toFixed(1)),
      P90: Number(((item.p90Hours ?? 0) / 24).toFixed(1)),
    }));
  }, [turnaround]);

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard del Laboratorio</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAll()}
            className="flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
            title="Actualizar ahora"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="size-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
            </svg>
          </button>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
              <SelectItem value="prev-month">Mes anterior</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="operations">Operaciones</TabsTrigger>
          <TabsTrigger value="quality">Calidad</TabsTrigger>
          {!permLoading && canViewFinancial && (
            <TabsTrigger value="financial">Financiero</TabsTrigger>
          )}
        </TabsList>

        {/* ═══════════════════════════════════════════════════
            Tab: Operaciones
            ═══════════════════════════════════════════════════ */}
        <TabsContent value="operations" className="space-y-6">
          {/* Row 1 — KPI Cards */}
          {loadingStatus ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <Skeleton className="h-4 w-24" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : errorStatus ? (
            <ErrorCard message={errorStatus} />
          ) : statusSummary ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard
                title="Muestras Hoy"
                value={formatNumber(
                  statusSummary.todayVsYesterday.received.today,
                )}
                delta={
                  statusSummary.todayVsYesterday.received.today -
                  statusSummary.todayVsYesterday.received.yesterday
                }
                deltaLabel="vs ayer"
              />
              <KpiCard
                title="Muestras Ayer"
                value={formatNumber(
                  statusSummary.todayVsYesterday.received.yesterday,
                )}
              />
              <KpiCard
                title="En Proceso"
                value={formatNumber(statusSummary.alerts.inProgress)}
              />
              <KpiCard
                title="Informes Validados Hoy"
                value={formatNumber(
                  statusSummary.todayVsYesterday.validated.today,
                )}
                delta={
                  statusSummary.todayVsYesterday.validated.today -
                  statusSummary.todayVsYesterday.validated.yesterday
                }
                deltaLabel="vs ayer"
              />
              <KpiCard
                title="Urgentes Activos"
                value={formatNumber(statusSummary.alerts.urgentActive)}
                variant={
                  statusSummary.alerts.urgentActive > 0 ? "danger" : "default"
                }
              />
            </div>
          ) : null}

          {/* Row 2 — Pipeline Funnel */}
          {loadingStatus ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ) : errorStatus ? null : (
            <Card>
              <CardHeader>
                <CardTitle>Pipeline de Muestras</CardTitle>
                <CardDescription>
                  Distribución actual por etapa del proceso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {pipelineData.map((stage, idx) => (
                    <div
                      key={stage.status}
                      className="flex flex-1 flex-col items-center gap-1.5"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {stage.label}
                      </span>
                      <span className="text-lg font-bold tabular-nums">
                        {stage.count}
                      </span>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(stage.pct, 2)}%` }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {stage.pct.toFixed(0)}%
                      </span>
                      {idx < pipelineData.length - 1 && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Row 3 — Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Volume by Day */}
            <Card>
              <CardHeader>
                <CardTitle>Muestras por Día</CardTitle>
                <CardDescription>Últimos 14 días por categoría</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingVolume ? (
                  <div className="flex h-[300px] items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : errorVolume ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-destructive">
                    {errorVolume}
                  </div>
                ) : volumeChartData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    Sin datos para el período
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={volumeChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Legend />
                      {volumeCategories.map((cat) => (
                        <Bar
                          key={cat}
                          dataKey={cat}
                          name={CATEGORY_LABELS[cat] || cat}
                          stackId="volume"
                          fill={
                            CATEGORY_COLORS[cat] || "hsl(200, 60%, 50%)"
                          }
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* TAT Chart */}
            <Card>
              <CardHeader>
                <CardTitle>TAT Promedio</CardTitle>
                <CardDescription>
                  Tiempo de respuesta por categoría (días)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTat ? (
                  <div className="flex h-[300px] items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : errorTat ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-destructive">
                    {errorTat}
                  </div>
                ) : tatChartData.length === 0 ? (
                  <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
                    Sin datos de TAT disponibles
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tatChartData}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis
                        dataKey="category"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v: number) => `${v}d`}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${value} días`,
                          undefined as unknown as string,
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="Promedio"
                        fill="hsl(221, 83%, 53%)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Mediana"
                        fill="hsl(160, 84%, 39%)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="P90"
                        fill="hsl(25, 95%, 53%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 4 — Pipeline Detail Table */}
          {!loadingStatus && !errorStatus && statusSummary && (
            <Card>
              <CardHeader>
                <CardTitle>Detalle por Estado y Categoría</CardTitle>
                <CardDescription>
                  Distribución completa de muestras
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Estado</TableHead>
                        {allCategories.map((cat) => (
                          <TableHead
                            key={cat}
                            className="text-right tabular-nums"
                          >
                            {CATEGORY_LABELS[cat] || cat}
                          </TableHead>
                        ))}
                        <TableHead className="text-right tabular-nums font-bold">
                          Total
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pipelineTableData.map(({ row }) => (
                        <TableRow key={row.status as string}>
                          <TableCell className="font-medium">
                            {row.status}
                          </TableCell>
                          {allCategories.map((cat) => (
                            <TableCell
                              key={cat}
                              className="text-right tabular-nums"
                            >
                              {(row[cat] as number) || 0}
                            </TableCell>
                          ))}
                          <TableCell className="text-right tabular-nums font-bold">
                            {row.total as number}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            Tab: Calidad
            ═══════════════════════════════════════════════════ */}
        <TabsContent value="quality" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard title="Conformidad SLA" value="—" placeholder />
            <KpiCard title="Enmiendas" value="—" placeholder />
            <KpiCard title="Tasa Rechazo" value="—" placeholder />
            <KpiCard
              title="Críticos sin Notificar"
              value={
                loadingStatus
                  ? "..."
                  : statusSummary
                    ? formatNumber(statusSummary.alerts.criticalUnnotified)
                    : "—"
              }
              variant={
                statusSummary && statusSummary.alerts.criticalUnnotified > 0
                  ? "danger"
                  : "default"
              }
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métricas de Calidad</CardTitle>
              <CardDescription>
                Próximamente: indicadores de conformidad SLA, tasa de rechazo y
                enmiendas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Estas métricas estarán disponibles cuando se configuren los
                parámetros de calidad del laboratorio.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════
            Tab: Financiero
            ═══════════════════════════════════════════════════ */}
        {!permLoading && canViewFinancial && (
          <TabsContent value="financial" className="space-y-6">
            {loadingFinancial ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <Skeleton className="h-4 w-24" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-8 w-20" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : errorFinancial ? (
              <ErrorCard message={errorFinancial} />
            ) : financial ? (
              <>
                {/* KPI Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <KpiCard
                    title="Total Facturado"
                    value={formatCLP(financial.charges.grandTotal)}
                  />
                  <KpiCard
                    title="Cargos Pendientes"
                    value={formatCLP(
                      financial.charges.byStatus
                        .filter((s) => s.status === "REGISTERED_CHARGE" || s.status === "VALIDATED_CHARGE")
                        .reduce((sum, s) => sum + Number(s.totalAmount), 0),
                    )}
                  />
                  <KpiCard
                    title="Top Procedencia"
                    value={
                      financial.topOrigins[0]?.originCode || "Sin datos"
                    }
                    subtitle={
                      financial.topOrigins[0]
                        ? formatCLP(financial.topOrigins[0].totalAmount)
                        : undefined
                    }
                  />
                </div>

                {/* Top Origins Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Top 10 Procedencias por Facturación</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Procedencia</TableHead>
                            <TableHead className="text-right">
                              Muestras
                            </TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financial.topOrigins
                            .slice(0, 10)
                            .map((origin, idx) => (
                              <TableRow key={origin.originCode}>
                                <TableCell className="tabular-nums text-muted-foreground">
                                  {idx + 1}
                                </TableCell>
                                <TableCell className="font-medium">
                                  {origin.originCode}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatNumber(origin.chargeCount)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatCLP(origin.totalAmount)}
                                </TableCell>
                              </TableRow>
                            ))}
                          {financial.topOrigins.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="text-center text-sm text-muted-foreground py-8"
                              >
                                Sin datos de procedencias
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {/* Liquidations Table */}
                <Card>
                  <CardHeader>
                    <CardTitle>Liquidaciones por Estado</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">
                              Cantidad
                            </TableHead>
                            <TableHead className="text-right">
                              Monto Total
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {financial.liquidations.map((liq) => (
                            <TableRow key={liq.status}>
                              <TableCell className="font-medium">
                                <Badge variant="outline" className="text-xs">
                                  {liq.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(liq.count)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCLP(liq.totalAmount)}
                              </TableCell>
                            </TableRow>
                          ))}
                          {financial.liquidations.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={3}
                                className="text-center text-sm text-muted-foreground py-8"
                              >
                                Sin liquidaciones
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ── Sub-components ──

function KpiCard({
  title,
  value,
  delta,
  deltaLabel,
  variant = "default",
  subtitle,
  placeholder,
}: {
  title: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  variant?: "default" | "danger";
  subtitle?: string;
  placeholder?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${
            variant === "danger" ? "text-destructive" : ""
          } ${placeholder ? "text-muted-foreground" : ""}`}
        >
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {delta !== undefined && (
          <p
            className={`text-xs mt-0.5 ${
              delta > 0
                ? "text-emerald-600"
                : delta < 0
                  ? "text-destructive"
                  : "text-muted-foreground"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta} {deltaLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ErrorCard({ message }: { message: string }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="py-6">
        <p className="text-sm text-destructive text-center">{message}</p>
      </CardContent>
    </Card>
  );
}
