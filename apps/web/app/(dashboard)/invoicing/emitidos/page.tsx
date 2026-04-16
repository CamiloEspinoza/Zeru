"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
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
  { value: "DRAFT", label: "Borrador" },
  { value: "QUEUED", label: "En cola" },
  { value: "SIGNED", label: "Firmado" },
  { value: "SENT", label: "Enviado" },
  { value: "ACCEPTED", label: "Aceptado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "VOIDED", label: "Anulado" },
  { value: "ERROR", label: "Error" },
];

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
      return "secondary";
    default:
      return "default";
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

interface DteListItem {
  id: string;
  dteType: string;
  folio: number;
  status: string;
  direction: string;
  receptorRut: string | null;
  receptorRazon: string | null;
  montoTotal: number;
  fechaEmision: string;
  createdAt: string;
}

const PER_PAGE = 20;

// ─── Component ────────────────────────────────────

function EmitidosContent() {
  const { tenant } = useTenantContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenantId") : null);
  const [dtes, setDtes] = useState<DteListItem[]>([]);
  const [loading, setLoading] = useState(!!tenantId);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const setFilters = useCallback(
    (updates: { status?: string; page?: number }) => {
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
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const fetchEmitidos = useCallback(() => {
    if (!tenantId) return;

    const params = new URLSearchParams();
    params.set("direction", "EMITTED");
    if (status) params.set("status", status);
    params.set("limit", String(PER_PAGE + 1));
    params.set("offset", String((page - 1) * PER_PAGE));

    setLoading(true);
    setError(null);

    api
      .get<DteListItem[]>(`/dte?${params.toString()}`, { tenantId })
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
  }, [tenantId, status, page]);

  useEffect(() => {
    fetchEmitidos(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchEmitidos]);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">DTEs Emitidos</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">DTEs Emitidos</h1>
          <p className="text-sm text-muted-foreground">
            Bandeja de documentos tributarios emitidos.
          </p>
        </div>
        <Button asChild>
          <Link href="/invoicing/new">Nueva emision</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Documentos</CardTitle>
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
                        Receptor
                      </th>
                      <th className="text-right py-2 px-3 font-medium">
                        Monto Total
                      </th>
                      <th className="text-left py-2 px-3 font-medium">
                        Estado
                      </th>
                      <th className="text-left py-2 px-3 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dtes.map((dte) => (
                      <tr
                        key={dte.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/invoicing/${dte.id}`)}
                      >
                        <td className="py-2 px-3">
                          {DTE_TYPE_SHORT_NAMES[dte.dteType] ?? dte.dteType}
                        </td>
                        <td className="py-2 px-3 font-mono">#{dte.folio}</td>
                        <td className="py-2 px-3">
                          <div className="max-w-[200px] truncate">
                            {dte.receptorRazon ?? "—"}
                          </div>
                          {dte.receptorRut && (
                            <div className="text-xs text-muted-foreground">
                              {dte.receptorRut}
                            </div>
                          )}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dtes.length === 0 && (
                <p className="text-muted-foreground py-6 text-center">
                  No hay DTEs emitidos con los filtros seleccionados.
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

export default function EmitidosPage() {
  return (
    <Suspense>
      <EmitidosContent />
    </Suspense>
  );
}
