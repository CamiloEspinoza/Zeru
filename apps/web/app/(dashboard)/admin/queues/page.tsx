"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "@/hooks/use-socket";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

// ── Types ──

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface QueueStats {
  name: string;
  displayName: string;
  isPaused: boolean;
  counts: QueueCounts;
}

interface JobSummary {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: Record<string, unknown>;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number | string;
  attemptsMade: number;
  attemptsTotal: number;
  failedReason: string | null;
  stacktrace: string[];
  returnvalue: unknown;
}

type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed";

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  waiting: { label: "En espera", variant: "outline" },
  active: { label: "Activo", variant: "default" },
  completed: { label: "Completado", variant: "secondary" },
  failed: { label: "Fallido", variant: "destructive" },
  delayed: { label: "Diferido", variant: "outline" },
};

const POLL_INTERVAL = 5000;

// ── Helper ──

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function formatDate(ts: number | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Main ──

const POLL_SECONDS = POLL_INTERVAL / 1000;

export default function QueuesPage() {
  const socket = useSocket();
  const [queues, setQueues] = useState<QueueStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQueue, setSelectedQueue] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>("active");
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [jobsTotal, setJobsTotal] = useState(0);
  const [jobsPage, setJobsPage] = useState(1);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<JobSummary | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(POLL_SECONDS);
  const lastWsUpdate = useRef(0);

  const perPage = 20;

  // ── Fetch queue stats ──
  const fetchQueues = useCallback(async () => {
    try {
      const data = await api.get<QueueStats[]>("/admin/queues");
      setQueues(data);
    } catch {
      // silent — polling will retry
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch jobs for selected queue ──
  const fetchJobs = useCallback(async () => {
    if (!selectedQueue) return;
    setJobsLoading(true);
    try {
      const res = await api.get<{ data: JobSummary[]; total: number }>(
        `/admin/queues/${selectedQueue}/jobs?status=${jobStatus}&page=${jobsPage}&perPage=${perPage}`
      );
      setJobs(res.data);
      setJobsTotal(res.total);
    } catch {
      // silent
    } finally {
      setJobsLoading(false);
    }
  }, [selectedQueue, jobStatus, jobsPage]);

  // ── WebSocket for queue stats ──
  useEffect(() => {
    if (!socket) {
      // Fallback: fetch once via REST if no socket yet
      fetchQueues();
      return;
    }

    const handler = (data: { queues: QueueStats[] }) => {
      setQueues(data.queues);
      setLoading(false);
      lastWsUpdate.current = Date.now();
      setCountdown(POLL_SECONDS);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- socket event not in strict type
    (socket as any).on("queues:stats", handler);

    // Also re-subscribe on reconnect
    const onConnect = () => fetchQueues();
    socket.on("connect", onConnect);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socket as any).off("queues:stats", handler);
      socket.off("connect", onConnect);
    };
  }, [socket, fetchQueues]);

  // ── Polling for jobs of selected queue (no WS for this) ──
  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  // ── Countdown (visual only — resets on each WS update) ──
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? POLL_SECONDS : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const forceRefresh = useCallback(() => {
    fetchQueues();
    fetchJobs();
    setCountdown(POLL_SECONDS);
  }, [fetchQueues, fetchJobs]);

  // Reset page when changing status or queue
  useEffect(() => {
    setJobsPage(1);
  }, [jobStatus, selectedQueue]);

  // ── Actions ──
  async function handleAction(
    action: string,
    method: "post" | "delete",
    url: string,
    successMsg: string
  ) {
    setActionLoading(action);
    try {
      if (method === "post") {
        await api.post(url, {});
      } else {
        await api.delete(url);
      }
      toast.success(successMsg);
      fetchQueues();
      fetchJobs();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(null);
    }
  }

  const totalJobs = (q: QueueStats) =>
    q.counts.waiting + q.counts.active + q.counts.completed + q.counts.failed + q.counts.delayed;

  const selectedQueueStats = queues.find((q) => q.name === selectedQueue);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colas de trabajo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitoreo y administración de colas BullMQ
          </p>
        </div>
        <button
          onClick={forceRefresh}
          className="relative flex items-center justify-center size-8 rounded-full hover:bg-muted transition-colors"
          title="Actualizar ahora"
        >
          <svg className="size-8 -rotate-90" viewBox="0 0 36 36">
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground/20"
            />
            <circle
              cx="18" cy="18" r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeDasharray={`${2 * Math.PI * 15.5}`}
              strokeDashoffset={`${2 * Math.PI * 15.5 * (1 - countdown / POLL_SECONDS)}`}
              strokeLinecap="round"
              className="text-primary transition-[stroke-dashoffset] duration-1000 linear"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[9px] font-medium tabular-nums text-muted-foreground">
            {countdown}
          </span>
        </button>
      </div>

      {/* Queue overview cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {loading
          ? Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))
          : queues.map((q) => (
              <Card
                key={q.name}
                className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedQueue === q.name ? "ring-2 ring-primary" : ""
                }`}
                onClick={() =>
                  setSelectedQueue(selectedQueue === q.name ? null : q.name)
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{q.displayName}</CardTitle>
                    <div className="flex items-center gap-2">
                      {q.isPaused && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                          Pausada
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs tabular-nums">
                        {totalJobs(q)} jobs
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {q.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-3 flex-wrap">
                    <CountBadge label="Espera" count={q.counts.waiting} color="text-blue-600" />
                    <CountBadge label="Activos" count={q.counts.active} color="text-green-600" />
                    <CountBadge label="Completados" count={q.counts.completed} color="text-muted-foreground" />
                    <CountBadge label="Fallidos" count={q.counts.failed} color="text-red-600" />
                    <CountBadge label="Diferidos" count={q.counts.delayed} color="text-amber-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Jobs panel for selected queue */}
      {selectedQueue && selectedQueueStats && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedQueueStats.displayName}</CardTitle>
                <CardDescription>
                  Detalle de jobs en la cola <code className="text-xs">{selectedQueue}</code>
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedQueueStats.isPaused ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === "resume"}
                    onClick={() =>
                      handleAction(
                        "resume",
                        "post",
                        `/admin/queues/${selectedQueue}/resume`,
                        "Cola reanudada"
                      )
                    }
                  >
                    {actionLoading === "resume" ? "..." : "Reanudar"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actionLoading === "pause"}
                    onClick={() =>
                      handleAction(
                        "pause",
                        "post",
                        `/admin/queues/${selectedQueue}/pause`,
                        "Cola pausada"
                      )
                    }
                  >
                    {actionLoading === "pause" ? "..." : "Pausar"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    actionLoading === "retry-all" ||
                    selectedQueueStats.counts.failed === 0
                  }
                  onClick={() =>
                    handleAction(
                      "retry-all",
                      "post",
                      `/admin/queues/${selectedQueue}/retry-all`,
                      "Jobs fallidos re-encolados"
                    )
                  }
                >
                  {actionLoading === "retry-all"
                    ? "..."
                    : `Reintentar fallidos (${selectedQueueStats.counts.failed})`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={
                    actionLoading === "clean" ||
                    selectedQueueStats.counts.completed === 0
                  }
                  onClick={() =>
                    handleAction(
                      "clean",
                      "post",
                      `/admin/queues/${selectedQueue}/clean?status=completed`,
                      "Jobs completados limpiados"
                    )
                  }
                >
                  {actionLoading === "clean" ? "..." : "Limpiar completados"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Status tabs */}
            <Tabs
              value={jobStatus}
              onValueChange={(v) => setJobStatus(v as JobStatus)}
            >
              <TabsList>
                {(Object.keys(STATUS_CONFIG) as JobStatus[]).map((s) => (
                  <TabsTrigger key={s} value={s} className="text-xs">
                    {STATUS_CONFIG[s].label}
                    {selectedQueueStats.counts[s] > 0 && (
                      <span className="ml-1.5 tabular-nums text-muted-foreground">
                        ({selectedQueueStats.counts[s]})
                      </span>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Jobs table */}
            {jobsLoading && jobs.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No hay jobs con estado &quot;{STATUS_CONFIG[jobStatus].label}&quot;
              </p>
            ) : (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">ID</TableHead>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="w-28">Progreso</TableHead>
                        <TableHead className="w-24">Intentos</TableHead>
                        <TableHead className="w-32">Creado</TableHead>
                        <TableHead className="w-28">Duración</TableHead>
                        <TableHead className="w-20">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => {
                        const duration =
                          job.processedOn && job.finishedOn
                            ? job.finishedOn - job.processedOn
                            : null;

                        return (
                          <TableRow
                            key={job.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedJob(job)}
                          >
                            <TableCell className="font-mono text-xs">
                              {job.id}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{job.name}</span>
                                {job.failedReason && (
                                  <Badge variant="destructive" className="text-xs truncate max-w-[200px]">
                                    {job.failedReason}
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <ProgressBar
                                value={
                                  typeof job.progress === "number"
                                    ? job.progress
                                    : 0
                                }
                              />
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {job.attemptsMade}/{job.attemptsTotal}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground tabular-nums">
                              {formatDate(job.timestamp)}
                            </TableCell>
                            <TableCell className="text-xs tabular-nums">
                              {duration !== null ? formatDuration(duration) : "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                {jobStatus === "failed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={actionLoading === `retry-${job.id}`}
                                    onClick={() =>
                                      handleAction(
                                        `retry-${job.id}`,
                                        "post",
                                        `/admin/queues/${selectedQueue}/jobs/${job.id}/retry`,
                                        "Job re-encolado"
                                      )
                                    }
                                  >
                                    Reintentar
                                  </Button>
                                )}
                                {(jobStatus === "completed" || jobStatus === "failed") && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-destructive hover:text-destructive"
                                    disabled={actionLoading === `rm-${job.id}`}
                                    onClick={() =>
                                      handleAction(
                                        `rm-${job.id}`,
                                        "delete",
                                        `/admin/queues/${selectedQueue}/jobs/${job.id}`,
                                        "Job eliminado"
                                      )
                                    }
                                  >
                                    Eliminar
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {jobsTotal > perPage && (
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-muted-foreground">
                      Mostrando {(jobsPage - 1) * perPage + 1}–
                      {Math.min(jobsPage * perPage, jobsTotal)} de {jobsTotal}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={jobsPage <= 1}
                        onClick={() => setJobsPage((p) => p - 1)}
                      >
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={jobsPage * perPage >= jobsTotal}
                        onClick={() => setJobsPage((p) => p + 1)}
                      >
                        Siguiente
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Job detail dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Job #{selectedJob.id}
                  <Badge variant={STATUS_CONFIG[jobStatus].variant} className="text-xs">
                    {STATUS_CONFIG[jobStatus].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  <span className="font-mono">{selectedJob.name}</span> en cola{" "}
                  <span className="font-mono">{selectedQueue}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Timestamps */}
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Creado</p>
                    <p className="tabular-nums">{formatDate(selectedJob.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Procesado</p>
                    <p className="tabular-nums">{formatDate(selectedJob.processedOn)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Finalizado</p>
                    <p className="tabular-nums">{formatDate(selectedJob.finishedOn)}</p>
                  </div>
                </div>

                {/* Progress + Attempts */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Progreso</p>
                    <ProgressBar
                      value={typeof selectedJob.progress === "number" ? selectedJob.progress : 0}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Intentos</p>
                    <p className="tabular-nums">
                      {selectedJob.attemptsMade} / {selectedJob.attemptsTotal}
                    </p>
                  </div>
                </div>

                {/* Data */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Data</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-48">
                    {JSON.stringify(selectedJob.data, null, 2)}
                  </pre>
                </div>

                {/* Options */}
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Opciones</p>
                  <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-32">
                    {JSON.stringify(selectedJob.opts, null, 2)}
                  </pre>
                </div>

                {/* Return value */}
                {selectedJob.returnvalue != null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Resultado</p>
                    <pre className="bg-muted p-3 rounded-lg text-xs overflow-x-auto max-h-32">
                      {JSON.stringify(selectedJob.returnvalue, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {selectedJob.failedReason && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Error</p>
                    <pre className="bg-destructive/10 text-destructive p-3 rounded-lg text-xs overflow-x-auto max-h-32">
                      {selectedJob.failedReason}
                    </pre>
                  </div>
                )}

                {/* Stack trace */}
                {selectedJob.stacktrace.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Stack trace</p>
                    <pre className="bg-destructive/10 text-destructive p-3 rounded-lg text-xs overflow-x-auto max-h-64">
                      {selectedJob.stacktrace.join("\n")}
                    </pre>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ──

function CountBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`font-bold tabular-nums ${color}`}>{count}</span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}
