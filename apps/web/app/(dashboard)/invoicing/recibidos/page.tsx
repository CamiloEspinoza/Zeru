"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";

// ─── Helpers ──────────────────────────────────────

const DTE_TYPE_SHORT_NAMES: Record<string, string> = {
  FACTURA_ELECTRONICA: "Factura",
  FACTURA_EXENTA_ELECTRONICA: "Factura Exenta",
  BOLETA_ELECTRONICA: "Boleta",
  BOLETA_EXENTA_ELECTRONICA: "Boleta Exenta",
  LIQUIDACION_FACTURA_ELECTRONICA: "Liq. Factura",
  FACTURA_COMPRA_ELECTRONICA: "Fact. Compra",
  GUIA_DESPACHO_ELECTRONICA: "Guia Despacho",
  NOTA_DEBITO_ELECTRONICA: "Nota Debito",
  NOTA_CREDITO_ELECTRONICA: "Nota Credito",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  QUEUED: "En cola",
  SIGNED: "Firmado",
  SENT: "Enviado",
  ACCEPTED: "Aceptado",
  ACCEPTED_WITH_OBJECTION: "Aceptado c/reparo",
  REJECTED: "Rechazado",
  VOIDED: "Anulado",
  ERROR: "Error",
};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "SENT", label: "Pendiente" },
  { value: "ACCEPTED", label: "Aceptado" },
  { value: "REJECTED", label: "Rechazado" },
];

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACCEPTED":
    case "ACCEPTED_WITH_OBJECTION":
      return "default";
    case "REJECTED":
      return "destructive";
    case "VOIDED":
      return "outline";
    default:
      return "secondary";
  }
}

function statusBadgeClassName(status: string): string {
  if (status === "ACCEPTED" || status === "ACCEPTED_WITH_OBJECTION") {
    return "bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/30 dark:text-green-400";
  }
  return "";
}

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

function daysUntilDeadline(deadlineDate: string | null): number | null {
  if (!deadlineDate) return null;
  const deadline = new Date(deadlineDate);
  const now = new Date();
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function deadlineBadge(days: number | null) {
  if (days === null) return null;
  if (days <= 0)
    return (
      <Badge variant="destructive" className="text-xs">
        Vencido
      </Badge>
    );
  if (days <= 3)
    return (
      <Badge variant="destructive" className="text-xs">
        {days}d
      </Badge>
    );
  if (days <= 5)
    return (
      <Badge variant="secondary" className="text-xs">
        {days}d
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-xs">
      {days}d
    </Badge>
  );
}

// ─── Interfaces ───────────────────────────────────

interface ReceivedDteItem {
  id: string;
  dteType: string;
  folio: number;
  status: string;
  direction: string;
  emisorRut: string;
  emisorRazon: string;
  montoTotal: number;
  fechaEmision: string;
  receptionDate: string | null;
  deadlineDate: string | null;
  decidedAt: string | null;
}

const PER_PAGE = 20;

// ─── Component ────────────────────────────────────

function RecibidosContent() {
  const { tenant } = useTenantContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenantId") : null);
  const [dtes, setDtes] = useState<ReceivedDteItem[]>([]);
  const [loading, setLoading] = useState(!!tenantId);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const status = searchParams.get("status") ?? "";
  const pendingOnly = searchParams.get("pending") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const setFilters = useCallback(
    (updates: { status?: string; page?: number; pending?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined) {
        if (updates.status && updates.status !== "all")
          params.set("status", updates.status);
        else params.delete("status");
      }
      if (updates.page !== undefined) {
        if (updates.page > 1) params.set("page", String(updates.page));
        else params.delete("page");
      }
      if (updates.pending !== undefined) {
        if (updates.pending) params.set("pending", "true");
        else params.delete("pending");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const fetchData = useCallback(() => {
    if (!tenantId) return;

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (pendingOnly) params.set("pending", "true");
    params.set("limit", String(PER_PAGE + 1));
    params.set("offset", String((page - 1) * PER_PAGE));

    setLoading(true);
    setError(null);

    api
      .get<ReceivedDteItem[]>(`/dte/received?${params.toString()}`, {
        tenantId,
      })
      .then((res) => {
        if (res.length > PER_PAGE) {
          setHasMore(true);
          setDtes(res.slice(0, PER_PAGE));
        } else {
          setHasMore(false);
          setDtes(res);
        }
      })
      .catch((err) => setError(err.message ?? "Error al cargar DTEs"))
      .finally(() => setLoading(false));
  }, [tenantId, status, pendingOnly, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAccept = async (dteId: string) => {
    if (!tenantId) return;
    setActionLoading(dteId);
    try {
      await api.post(`/dte/received/${dteId}/accept`, {}, { tenantId });
      fetchData();
    } catch (err) {
      setError((err as Error).message ?? "Error al aceptar DTE");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (dteId: string) => {
    if (!tenantId) return;
    setActionLoading(dteId);
    try {
      await api.post(
        `/dte/received/${dteId}/reject`,
        { reason: "Rechazado por el usuario" },
        { tenantId },
      );
      fetchData();
    } catch (err) {
      setError((err as Error).message ?? "Error al rechazar DTE");
    } finally {
      setActionLoading(null);
    }
  };

  const isPending = (dte: ReceivedDteItem) =>
    !dte.decidedAt &&
    (dte.status === "SENT" || dte.status === "SIGNED");

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">DTEs Recibidos</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => {
                setError(null);
                fetchData();
              }}
            >
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">DTEs Recibidos</h1>
        <p className="text-sm text-muted-foreground">
          Bandeja de documentos tributarios recibidos de proveedores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Documentos recibidos</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={pendingOnly ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setFilters({ pending: !pendingOnly, page: 1 })
                }
              >
                Solo pendientes
              </Button>
              <Select
                value={status || "all"}
                onValueChange={(v) =>
                  setFilters({ status: v === "all" ? "" : v, page: 1 })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Tipo</th>
                      <th className="text-left py-2 px-3 font-medium">Folio</th>
                      <th className="text-left py-2 px-3 font-medium">
                        Emisor
                      </th>
                      <th className="text-right py-2 px-3 font-medium">
                        Monto Total
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Estado
                      </th>
                      <th className="text-left py-2 px-3 font-medium">Fecha</th>
                      <th className="text-left py-2 px-3 font-medium">Plazo</th>
                      <th className="text-left py-2 px-3 font-medium">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dtes.map((dte) => {
                      const days = daysUntilDeadline(dte.deadlineDate);
                      const pending = isPending(dte);
                      return (
                        <tr
                          key={dte.id}
                          className="border-b last:border-0 hover:bg-muted/40"
                        >
                          <td className="py-2 px-3">
                            {DTE_TYPE_SHORT_NAMES[dte.dteType] ?? dte.dteType}
                          </td>
                          <td className="py-2 px-3 font-mono">#{dte.folio}</td>
                          <td className="py-2 px-3">
                            <div className="max-w-[200px] truncate">
                              {dte.emisorRazon}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dte.emisorRut}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {clpFormatter.format(dte.montoTotal)}
                          </td>
                          <td className="py-2 px-3">
                            <Badge
                              variant={statusBadgeVariant(dte.status)}
                              className={statusBadgeClassName(dte.status)}
                            >
                              {STATUS_LABELS[dte.status] ?? dte.status}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {new Date(dte.fechaEmision).toLocaleDateString(
                              "es-CL",
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {pending ? deadlineBadge(days) : "—"}
                          </td>
                          <td className="py-2 px-3">
                            {pending ? (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  disabled={actionLoading === dte.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAccept(dte.id);
                                  }}
                                >
                                  Aceptar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-7 text-xs"
                                  disabled={actionLoading === dte.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReject(dte.id);
                                  }}
                                >
                                  Rechazar
                                </Button>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() =>
                                  router.push(`/invoicing/${dte.id}`)
                                }
                              >
                                Ver
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {dtes.length === 0 && (
                <p className="text-muted-foreground py-6 text-center">
                  No hay DTEs recibidos con los filtros seleccionados.
                </p>
              )}

              {(page > 1 || hasMore) && (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setFilters({ page: page - 1 })}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Pagina {page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!hasMore}
                    onClick={() => setFilters({ page: page + 1 })}
                  >
                    Siguiente
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function RecibidosPage() {
  return (
    <Suspense>
      <RecibidosContent />
    </Suspense>
  );
}
