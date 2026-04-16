"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CheckmarkCircle01Icon,
  Clock01Icon,
  Loading02Icon,
  Alert02Icon,
} from "@hugeicons/core-free-icons";

// ─── Types ────────────────────────────────────────────

enum CertificationStage {
  NOT_STARTED = "NOT_STARTED",
  STAGE_1_SET_PRUEBAS = "STAGE_1_SET_PRUEBAS",
  STAGE_2_SIMULACION = "STAGE_2_SIMULACION",
  STAGE_3_INTERCAMBIO = "STAGE_3_INTERCAMBIO",
  STAGE_4_MUESTRAS_PDF = "STAGE_4_MUESTRAS_PDF",
  STAGE_5_DECLARACION = "STAGE_5_DECLARACION",
  STAGE_6_AUTORIZACION = "STAGE_6_AUTORIZACION",
  COMPLETED = "COMPLETED",
}

interface StageDetail {
  status: "pending" | "in_progress" | "completed" | "error";
  startedAt?: string;
  completedAt?: string;
  error?: string;
  result?: Record<string, unknown>;
}

interface CertificationData {
  currentStage: CertificationStage;
  startedAt: string | null;
  completedAt: string | null;
  stages: Record<string, StageDetail>;
}

interface CertificationStatus {
  configured: boolean;
  environment?: string;
  certification: CertificationData;
}

// ─── Stage metadata ──────────────────────────────────

interface StageMeta {
  key: CertificationStage;
  number: number;
  title: string;
  description: string;
  instructions: string;
  automated: boolean;
}

const STAGES: StageMeta[] = [
  {
    key: CertificationStage.STAGE_1_SET_PRUEBAS,
    number: 1,
    title: "Set de Pruebas",
    description: "Generacion y envio del set de pruebas al SII",
    instructions:
      "Se generaran automaticamente facturas, notas de credito y notas de debito con los patrones requeridos por el SII. " +
      "Los documentos se firman y envian al ambiente de certificacion. " +
      "Requiere: certificado digital activo y folios disponibles para Factura, NC y ND.",
    automated: true,
  },
  {
    key: CertificationStage.STAGE_2_SIMULACION,
    number: 2,
    title: "Simulacion",
    description: "Simulacion con datos reales de facturacion",
    instructions:
      "Emita documentos de prueba usando el flujo normal de emision (menu Facturacion > Nueva emision). " +
      "Envie al menos 3 facturas y 1 nota de credito al SII de certificacion. " +
      "Verifique que todos sean aceptados antes de marcar como completado.",
    automated: true,
  },
  {
    key: CertificationStage.STAGE_3_INTERCAMBIO,
    number: 3,
    title: "Intercambio de DTEs",
    description: "Prueba de intercambio electronico de documentos",
    instructions:
      "Realice el intercambio de DTEs con el receptor de prueba del SII. " +
      "Esto incluye el envio de acuse de recibo y aceptacion/rechazo comercial. " +
      "Siga las instrucciones del set de pruebas proporcionado por el SII.",
    automated: false,
  },
  {
    key: CertificationStage.STAGE_4_MUESTRAS_PDF,
    number: 4,
    title: "Muestras Impresas (PDF)",
    description: "Carga de muestras impresas de los documentos",
    instructions:
      "Genere PDFs de los documentos emitidos en las etapas anteriores. " +
      "Suba las muestras impresas al portal del SII (mipyme.sii.cl). " +
      "Asegurese de que incluyan el timbre electronico (codigo de barras PDF417) correctamente.",
    automated: false,
  },
  {
    key: CertificationStage.STAGE_5_DECLARACION,
    number: 5,
    title: "Declaracion Jurada",
    description: "Declaracion de cumplimiento de requisitos",
    instructions:
      "Complete la declaracion jurada en el portal del SII que certifica " +
      "que su sistema cumple con todos los requisitos tecnicos para la emision de DTEs. " +
      "Acceda a: www.sii.cl > Factura electronica > Certificacion.",
    automated: false,
  },
  {
    key: CertificationStage.STAGE_6_AUTORIZACION,
    number: 6,
    title: "Autorizacion Final",
    description: "Obtencion de la resolucion de autorizacion del SII",
    instructions:
      "Una vez aprobadas todas las etapas anteriores, el SII emitira la resolucion " +
      "que autoriza a su empresa a emitir documentos tributarios electronicos en produccion. " +
      "Cuando reciba la notificacion de aprobacion, cambie el ambiente a Produccion en la configuracion.",
    automated: false,
  },
];

const STAGE_ORDER = [
  CertificationStage.NOT_STARTED,
  CertificationStage.STAGE_1_SET_PRUEBAS,
  CertificationStage.STAGE_2_SIMULACION,
  CertificationStage.STAGE_3_INTERCAMBIO,
  CertificationStage.STAGE_4_MUESTRAS_PDF,
  CertificationStage.STAGE_5_DECLARACION,
  CertificationStage.STAGE_6_AUTORIZACION,
  CertificationStage.COMPLETED,
];

// ─── Helpers ──────────────────────────────────────────

function getStageIndex(stage: CertificationStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function statusBadge(detail: StageDetail | undefined) {
  if (!detail) return null;
  switch (detail.status) {
    case "completed":
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400">
          Completado
        </Badge>
      );
    case "in_progress":
      return <Badge variant="secondary">En progreso</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">Pendiente</Badge>;
  }
}

function StageIcon({
  detail,
  isCurrent,
}: {
  detail: StageDetail | undefined;
  isCurrent: boolean;
}) {
  if (detail?.status === "completed") {
    return (
      <HugeiconsIcon
        icon={CheckmarkCircle01Icon}
        className="size-6 text-green-500"
      />
    );
  }
  if (detail?.status === "error") {
    return <HugeiconsIcon icon={Alert02Icon} className="size-6 text-red-500" />;
  }
  if (detail?.status === "in_progress" || isCurrent) {
    return (
      <span className="size-6 flex items-center justify-center">
        <span className="size-3 rounded-full bg-amber-400 animate-pulse" />
      </span>
    );
  }
  return (
    <HugeiconsIcon
      icon={Clock01Icon}
      className="size-6 text-muted-foreground"
    />
  );
}

// ─── Component ────────────────────────────────────────

export default function CertificationPage() {
  const { tenant } = useTenantContext();
  const tenantId =
    tenant?.id ??
    (typeof window !== "undefined"
      ? localStorage.getItem("tenantId")
      : null);

  const [status, setStatus] = useState<CertificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchStatus = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    api
      .get<CertificationStatus>("/dte/certification/status", { tenantId })
      .then(setStatus)
      .catch((err) => setError(err.message ?? "Error al cargar estado"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleStage1 = async () => {
    if (!tenantId) return;
    setActionLoading("stage1");
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.post<{
        certification: CertificationData;
        generatedDtes: Array<{
          dteType: string;
          folio: number;
          montoTotal: number;
        }>;
      }>("/dte/certification/stage1", {}, { tenantId });
      setStatus((prev) =>
        prev ? { ...prev, certification: result.certification } : prev
      );
      const dteCount = result.generatedDtes?.length ?? 0;
      setSuccessMessage(
        `Set de pruebas generado: ${dteCount} documentos creados y enviados al SII.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al ejecutar etapa 1";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStage2 = async () => {
    if (!tenantId) return;
    setActionLoading("stage2");
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.post<{
        certification: CertificationData;
        message: string;
      }>("/dte/certification/stage2", {}, { tenantId });
      setStatus((prev) =>
        prev ? { ...prev, certification: result.certification } : prev
      );
      setSuccessMessage(result.message);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al ejecutar etapa 2";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdvance = async (stage?: CertificationStage) => {
    if (!tenantId) return;
    setActionLoading(stage ?? "advance");
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.post<{ certification: CertificationData }>(
        "/dte/certification/advance",
        { stage },
        { tenantId }
      );
      setStatus((prev) =>
        prev ? { ...prev, certification: result.certification } : prev
      );
      setSuccessMessage("Etapa marcada como completada.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al avanzar etapa";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReset = async () => {
    if (!tenantId) return;
    setActionLoading("reset");
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await api.post<{ certification: CertificationData }>(
        "/dte/certification/reset",
        {},
        { tenantId }
      );
      setStatus((prev) =>
        prev ? { ...prev, certification: result.certification } : prev
      );
      setSuccessMessage("Certificacion reiniciada.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al reiniciar";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!status?.configured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Certificacion SII</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              Debe configurar los datos del emisor antes de iniciar la
              certificacion.
            </p>
            <Button className="mt-4" asChild>
              <a href="/settings/invoicing">Ir a configuracion</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cert = status.certification;
  const currentStageIndex = getStageIndex(cert.currentStage);
  const isCompleted = cert.currentStage === CertificationStage.COMPLETED;

  const completedCount = STAGES.filter(
    (s) => cert.stages[s.key]?.status === "completed"
  ).length;
  const progressPct = Math.round((completedCount / STAGES.length) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Certificacion SII</h1>
          <p className="text-sm text-muted-foreground">
            Proceso de certificacion para emision de documentos tributarios
            electronicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.environment && (
            <Badge variant="outline" className="text-xs">
              Ambiente: {status.environment === "CERTIFICATION" ? "Certificacion" : "Produccion"}
            </Badge>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading !== null}
              >
                Reiniciar certificacion
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reiniciar certificacion</AlertDialogTitle>
                <AlertDialogDescription>
                  Esto eliminara todo el progreso de certificacion y debera
                  comenzar desde la etapa 1. Esta accion no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>
                  Reiniciar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-4">
          <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 p-4">
          <p className="text-sm text-green-800 dark:text-green-400">
            {successMessage}
          </p>
        </div>
      )}

      {/* Progress summary */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {isCompleted
                ? "Certificacion completada"
                : `${completedCount} de ${STAGES.length} etapas completadas`}
            </span>
            <span className="text-sm text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCompleted ? "bg-green-500" : "bg-primary"
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {cert.startedAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Iniciada el{" "}
              {new Date(cert.startedAt).toLocaleDateString("es-CL", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              {cert.completedAt && (
                <>
                  {" "}
                  — Completada el{" "}
                  {new Date(cert.completedAt).toLocaleDateString("es-CL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stages */}
      <div className="space-y-4">
        {STAGES.map((stageMeta) => {
          const detail = cert.stages[stageMeta.key];
          const stageIndex = getStageIndex(stageMeta.key);
          const isCurrent = cert.currentStage === stageMeta.key;
          const isPast = stageIndex < currentStageIndex;
          const isFuture = stageIndex > currentStageIndex;

          const canStartStage1 =
            stageMeta.key === CertificationStage.STAGE_1_SET_PRUEBAS &&
            (cert.currentStage === CertificationStage.NOT_STARTED ||
              (isCurrent && detail?.status !== "completed"));

          const canStartStage2 =
            stageMeta.key === CertificationStage.STAGE_2_SIMULACION &&
            isCurrent &&
            detail?.status !== "completed" &&
            detail?.status !== "in_progress";

          const canMarkComplete =
            isCurrent &&
            !canStartStage1 &&
            !(
              stageMeta.key === CertificationStage.STAGE_2_SIMULACION &&
              detail?.status !== "in_progress" &&
              detail?.status !== "completed"
            ) &&
            detail?.status !== "completed";

          return (
            <Card
              key={stageMeta.key}
              className={`transition-all ${
                isCurrent
                  ? "ring-2 ring-primary/50 shadow-sm"
                  : isPast
                    ? "opacity-75"
                    : isFuture
                      ? "opacity-50"
                      : ""
              }`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <StageIcon detail={detail} isCurrent={isCurrent} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">
                        Etapa {stageMeta.number}: {stageMeta.title}
                      </CardTitle>
                      {statusBadge(detail)}
                      {isCurrent && !isCompleted && (
                        <Badge variant="secondary" className="text-xs">
                          Actual
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">
                      {stageMeta.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-12">
                {/* Instructions */}
                <div className="rounded-md bg-muted/50 p-3 mb-3">
                  <p className="text-sm text-muted-foreground">
                    {stageMeta.instructions}
                  </p>
                </div>

                {/* Error message */}
                {detail?.error && (
                  <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800 p-3 mb-3">
                    <p className="text-sm text-red-800 dark:text-red-400">
                      {detail.error}
                    </p>
                  </div>
                )}

                {/* Stage result details */}
                {detail?.result && detail.status === "completed" && (
                  <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-900/10 dark:border-green-800 p-3 mb-3">
                    <p className="text-sm text-green-800 dark:text-green-400">
                      {detail.result.totalDocuments
                        ? `${detail.result.totalDocuments} documentos generados`
                        : "Etapa completada exitosamente"}
                      {detail.result.trackId && (
                        <> — Track ID: {String(detail.result.trackId)}</>
                      )}
                    </p>
                  </div>
                )}

                {/* Timestamps */}
                {(detail?.startedAt || detail?.completedAt) && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {detail.startedAt && (
                      <>
                        Iniciada:{" "}
                        {new Date(detail.startedAt).toLocaleString("es-CL")}
                      </>
                    )}
                    {detail.completedAt && (
                      <>
                        {" "}
                        — Completada:{" "}
                        {new Date(detail.completedAt).toLocaleString("es-CL")}
                      </>
                    )}
                  </p>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {canStartStage1 && (
                    <Button
                      size="sm"
                      onClick={handleStage1}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "stage1" ? (
                        <>
                          <HugeiconsIcon
                            icon={Loading02Icon}
                            className="size-4 mr-2 animate-spin"
                          />
                          Generando set de pruebas...
                        </>
                      ) : detail?.status === "error" ? (
                        "Reintentar etapa 1"
                      ) : (
                        "Iniciar set de pruebas"
                      )}
                    </Button>
                  )}

                  {canStartStage2 && (
                    <Button
                      size="sm"
                      onClick={handleStage2}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === "stage2" ? (
                        <>
                          <HugeiconsIcon
                            icon={Loading02Icon}
                            className="size-4 mr-2 animate-spin"
                          />
                          Iniciando...
                        </>
                      ) : (
                        "Iniciar simulacion"
                      )}
                    </Button>
                  )}

                  {canMarkComplete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdvance(stageMeta.key)}
                      disabled={actionLoading !== null}
                    >
                      {actionLoading === stageMeta.key ? (
                        <>
                          <HugeiconsIcon
                            icon={Loading02Icon}
                            className="size-4 mr-2 animate-spin"
                          />
                          Avanzando...
                        </>
                      ) : (
                        "Marcar completado"
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
