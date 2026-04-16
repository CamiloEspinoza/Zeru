"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function statusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "DRAFT":
      return "secondary";
    case "ACCEPTED":
    case "ACCEPTED_WITH_OBJECTION":
      return "default";
    case "REJECTED":
    case "ERROR":
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

// ─── Interfaces ───────────────────────────────────

interface IvaSummary {
  emitted: { neto: number; exento: number; iva: number; total: number; count: number };
  received: { neto: number; exento: number; iva: number; total: number; count: number };
  ivaDebito: number;
  ivaCredito: number;
  ivaPorPagar: number;
}

interface DteListItem {
  id: string;
  dteType: string;
  folio: number;
  status: string;
  direction: string;
  receptorRut: string | null;
  receptorRazon: string | null;
  emisorRut: string;
  emisorRazon: string;
  montoTotal: number;
  fechaEmision: string;
  createdAt: string;
}

// ─── Component ────────────────────────────────────

export default function InvoicingDashboard() {
  const { tenant } = useTenantContext();
  const router = useRouter();

  const [summary, setSummary] = useState<IvaSummary | null>(null);
  const [recentEmitted, setRecentEmitted] = useState<DteListItem[]>([]);
  const [pendingReceivedCount, setPendingReceivedCount] = useState<number>(0);
  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenantId") : null);
  const [loading, setLoading] = useState(!!tenantId);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(() => {
    if (!tenantId) return;

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    setLoading(true);
    setError(null);

    Promise.all([
      api
        .get<IvaSummary>(
          `/dte/reports/iva-summary?from=${currentMonth}&to=${currentMonth}`,
          { tenantId },
        )
        .catch(() => null),
      api
        .get<DteListItem[]>(
          `/dte?direction=EMITTED&limit=5`,
          { tenantId },
        )
        .catch(() => []),
      api
        .get<DteListItem[]>(
          `/dte/received?pending=true&limit=1`,
          { tenantId },
        )
        .catch(() => []),
    ])
      .then(([ivaSummary, recent, pending]) => {
        if (ivaSummary) setSummary(ivaSummary);
        setRecentEmitted(recent as DteListItem[]);
        setPendingReceivedCount(Array.isArray(pending) ? pending.length : 0);
      })
      .catch((err) => setError(err.message ?? "Error al cargar datos"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    fetchDashboard(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchDashboard]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Facturacion</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Facturacion</h1>
          <p className="text-sm text-muted-foreground">
            Resumen mensual de documentos tributarios electronicos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild>
            <Link href="/invoicing/new">Nueva emision</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/invoicing/emitidos">Emitidos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/invoicing/recibidos">Recibidos</Link>
          </Button>
        </div>
      </div>

      {/* IVA Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen del mes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : summary ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total emitidos</p>
                <p className="text-lg font-semibold tabular-nums">
                  {clpFormatter.format(summary.emitted.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.emitted.count} documentos
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total recibidos</p>
                <p className="text-lg font-semibold tabular-nums">
                  {clpFormatter.format(summary.received.total)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.received.count} documentos
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">IVA debito</p>
                <p className="text-lg font-semibold tabular-nums">
                  {clpFormatter.format(summary.ivaDebito)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">IVA credito</p>
                <p className="text-lg font-semibold tabular-nums">
                  {clpFormatter.format(summary.ivaCredito)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">IVA por pagar</p>
                <p className="text-lg font-semibold tabular-nums">
                  {clpFormatter.format(summary.ivaPorPagar)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No hay datos para el periodo actual.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Emitted */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Ultimos emitidos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/invoicing/emitidos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentEmitted.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                No hay DTEs emitidos.
              </p>
            ) : (
              <div className="space-y-2">
                {recentEmitted.map((dte) => (
                  <div
                    key={dte.id}
                    className="flex items-center justify-between py-2 px-2 rounded hover:bg-muted/40 cursor-pointer"
                    onClick={() => router.push(`/invoicing/${dte.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {DTE_TYPE_SHORT_NAMES[dte.dteType] ?? dte.dteType} #{dte.folio}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {dte.receptorRazon ?? "Sin receptor"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm tabular-nums">
                        {clpFormatter.format(dte.montoTotal)}
                      </span>
                      <Badge
                        variant={statusBadgeVariant(dte.status)}
                        className={statusBadgeClassName(dte.status)}
                      >
                        {STATUS_LABELS[dte.status] ?? dte.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Received */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recibidos pendientes</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/invoicing/recibidos">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="text-center py-4">
                <p className="text-3xl font-bold tabular-nums">
                  {pendingReceivedCount}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  documentos pendientes de aceptar/rechazar
                </p>
                {pendingReceivedCount > 0 && (
                  <Button className="mt-3" size="sm" asChild>
                    <Link href="/invoicing/recibidos?pending=true">
                      Revisar pendientes
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
