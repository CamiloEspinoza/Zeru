"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";

// ─── Helpers ──────────────────────────────────────

const DTE_TYPE_NAMES: Record<string, string> = {
  FACTURA_ELECTRONICA: "Factura Electrónica",
  FACTURA_EXENTA_ELECTRONICA: "Factura Exenta Electrónica",
  BOLETA_ELECTRONICA: "Boleta Electrónica",
  BOLETA_EXENTA_ELECTRONICA: "Boleta Exenta Electrónica",
  LIQUIDACION_FACTURA_ELECTRONICA: "Liquidación-Factura Electrónica",
  FACTURA_COMPRA_ELECTRONICA: "Factura de Compra Electrónica",
  GUIA_DESPACHO_ELECTRONICA: "Guía de Despacho Electrónica",
  NOTA_DEBITO_ELECTRONICA: "Nota de Débito Electrónica",
  NOTA_CREDITO_ELECTRONICA: "Nota de Crédito Electrónica",
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

const LOG_ACTION_LABELS: Record<string, string> = {
  CREATED: "Creado",
  QUEUED: "Encolado",
  FOLIO_ASSIGNED: "Folio asignado",
  SIGNED: "Firmado",
  SENT_TO_SII: "Enviado al SII",
  SII_RESPONSE: "Respuesta del SII",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  VOIDED: "Anulado",
  ERROR: "Error",
  EXCHANGE_SENT: "Intercambio enviado",
  EXCHANGE_RECEIVED: "Intercambio recibido",
  ACCOUNTING_POSTED: "Contabilizado",
  PDF_GENERATED: "PDF generado",
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

interface DteItem {
  id: string;
  lineNumber: number;
  itemName: string;
  description: string | null;
  indExe: number | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  montoItem: string;
}

interface DteReference {
  id: string;
  lineNumber: number;
  tipoDocRef: number;
  folioRef: number;
  fechaRef: string;
  codRef: string | null;
  razonRef: string | null;
}

interface DteLog {
  id: string;
  action: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  actorId: string | null;
  createdAt: string;
}

interface DteDetail {
  id: string;
  dteType: string;
  folio: number;
  environment: string;
  status: string;
  direction: string;
  emisorRut: string;
  emisorRazon: string;
  emisorGiro: string | null;
  receptorRut: string | null;
  receptorRazon: string | null;
  receptorGiro: string | null;
  receptorDir: string | null;
  receptorComuna: string | null;
  receptorCiudad: string | null;
  montoNeto: number;
  montoExento: number;
  iva: number;
  montoTotal: number;
  fechaEmision: string;
  fechaVenc: string | null;
  xmlContent: string | null;
  items: DteItem[];
  references: DteReference[];
  logs: DteLog[];
}

// ─── Component ────────────────────────────────────

export default function DteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant } = useTenantContext();
  const router = useRouter();

  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenantId") : null);
  const [dte, setDte] = useState<DteDetail | null>(null);
  const [loading, setLoading] = useState(!!tenantId && !!id);
  const [error, setError] = useState<string | null>(null);
  const [voidLoading, setVoidLoading] = useState(false);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");
  const [publicLink, setPublicLink] = useState<string | null>(null);

  const fetchDte = useCallback(() => {
    if (!tenantId || !id) return;

    setLoading(true);
    setError(null);

    api
      .get<DteDetail>(`/dte/${id}`, { tenantId })
      .then(setDte)
      .catch((err) => setError(err.message ?? "Error al cargar DTE"))
      .finally(() => setLoading(false));
  }, [tenantId, id]);

  useEffect(() => {
    fetchDte();
  }, [fetchDte]);

  const handleDownloadPdf = async () => {
    if (!tenantId || !id) return;
    try {
      const token = localStorage.getItem("access_token");
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";
      const response = await fetch(`${apiBase}/dte/${id}/pdf`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": tenantId ?? "",
        },
      });
      if (!response.ok) throw new Error("Error al descargar PDF");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DTE-${dte?.folio ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error al descargar el PDF");
    }
  };

  const handleDownloadXml = async () => {
    if (!tenantId || !id) return;
    try {
      const token = localStorage.getItem("access_token");
      const apiBase =
        process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";
      const response = await fetch(`${apiBase}/dte/${id}/xml`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-Id": tenantId ?? "",
        },
      });
      if (!response.ok) throw new Error("Error al descargar XML");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `DTE-${dte?.folio ?? id}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Error al descargar el XML");
    }
  };

  const handleGenerateLink = async () => {
    if (!tenantId || !id) return;
    try {
      const res = await api.post<{ url: string }>(
        `/dte/${id}/public-link`,
        {},
        { tenantId },
      );
      setPublicLink(res.url);
    } catch (err) {
      setError((err as Error).message ?? "Error al generar enlace");
    }
  };

  const handleVoid = async () => {
    if (!tenantId || !id || !voidReason.trim()) return;

    setVoidLoading(true);
    try {
      await api.post(`/dte/${id}/void`, { reason: voidReason.trim() }, { tenantId });
      setVoidDialogOpen(false);
      setVoidReason("");
      fetchDte();
    } catch (err) {
      setError((err as Error).message ?? "Error al anular DTE");
    } finally {
      setVoidLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !dte) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Detalle DTE</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">{error ?? "DTE no encontrado"}</p>
            <Button variant="outline" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canVoid =
    dte.status === "ACCEPTED" || dte.status === "ACCEPTED_WITH_OBJECTION";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">
              {DTE_TYPE_NAMES[dte.dteType] ?? dte.dteType} #{dte.folio}
            </h1>
            <Badge
              variant={statusBadgeVariant(dte.status)}
              className={statusBadgeClassName(dte.status)}
            >
              {STATUS_LABELS[dte.status] ?? dte.status}
            </Badge>
            <Badge variant="outline">
              {dte.direction === "EMITTED" ? "Emitido" : "Recibido"}
            </Badge>
            {dte.environment === "CERTIFICATION" && (
              <Badge variant="secondary">Certificación</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Emitido el{" "}
            {new Date(dte.fechaEmision).toLocaleDateString("es-CL", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            {dte.fechaVenc &&
              ` | Vence el ${new Date(dte.fechaVenc).toLocaleDateString("es-CL")}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            Descargar PDF
          </Button>
          {dte.xmlContent && (
            <Button variant="outline" size="sm" onClick={handleDownloadXml}>
              Descargar XML
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleGenerateLink}>
            Enlace publico
          </Button>
          {canVoid && (
            <Button
              variant="destructive"
              size="sm"
              disabled={voidLoading}
              onClick={() => setVoidDialogOpen(true)}
            >
              {voidLoading ? "Anulando..." : "Anular"}
            </Button>
          )}
        </div>
      </div>

      {/* Public Link */}
      {publicLink && (
        <Card>
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground mb-1">
              Enlace publico (expira en 30 dias):
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded break-all">
              {publicLink}
            </code>
          </CardContent>
        </Card>
      )}

      {/* Emisor / Receptor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Emisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">RUT:</span>{" "}
              {dte.emisorRut}
            </p>
            <p>
              <span className="text-muted-foreground">Razón social:</span>{" "}
              {dte.emisorRazon}
            </p>
            {dte.emisorGiro && (
              <p>
                <span className="text-muted-foreground">Giro:</span>{" "}
                {dte.emisorGiro}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receptor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {dte.receptorRut ? (
              <>
                <p>
                  <span className="text-muted-foreground">RUT:</span>{" "}
                  {dte.receptorRut}
                </p>
                <p>
                  <span className="text-muted-foreground">Razón social:</span>{" "}
                  {dte.receptorRazon}
                </p>
                {dte.receptorGiro && (
                  <p>
                    <span className="text-muted-foreground">Giro:</span>{" "}
                    {dte.receptorGiro}
                  </p>
                )}
                {dte.receptorDir && (
                  <p>
                    <span className="text-muted-foreground">Dirección:</span>{" "}
                    {dte.receptorDir}
                    {dte.receptorComuna && `, ${dte.receptorComuna}`}
                    {dte.receptorCiudad && `, ${dte.receptorCiudad}`}
                  </p>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">Sin receptor especificado</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle de items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Item</th>
                  <th className="text-right py-2 px-3 font-medium">
                    Cantidad
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    Precio Unit.
                  </th>
                  <th className="text-right py-2 px-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {dte.items
                  .sort((a, b) => a.lineNumber - b.lineNumber)
                  .map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 px-3 text-muted-foreground">
                        {item.lineNumber}
                      </td>
                      <td className="py-2 px-3">
                        <div>{item.itemName}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                        {item.indExe === 1 && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Exento
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {Number(item.quantity)}
                        {item.unit && (
                          <span className="text-muted-foreground ml-1">
                            {item.unit}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        {clpFormatter.format(Number(item.unitPrice))}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium">
                        {clpFormatter.format(Number(item.montoItem))}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Totales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              {dte.montoNeto > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Neto</span>
                  <span className="tabular-nums">
                    {clpFormatter.format(dte.montoNeto)}
                  </span>
                </div>
              )}
              {dte.montoExento > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Exento</span>
                  <span className="tabular-nums">
                    {clpFormatter.format(dte.montoExento)}
                  </span>
                </div>
              )}
              {dte.iva > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span className="tabular-nums">
                    {clpFormatter.format(dte.iva)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {clpFormatter.format(dte.montoTotal)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* References */}
      {dte.references.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Referencias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">
                      Tipo Doc.
                    </th>
                    <th className="text-left py-2 px-3 font-medium">Folio</th>
                    <th className="text-left py-2 px-3 font-medium">Fecha</th>
                    <th className="text-left py-2 px-3 font-medium">Código</th>
                    <th className="text-left py-2 px-3 font-medium">Razón</th>
                  </tr>
                </thead>
                <tbody>
                  {dte.references.map((ref) => (
                    <tr key={ref.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{ref.tipoDocRef}</td>
                      <td className="py-2 px-3 font-mono">{ref.folioRef}</td>
                      <td className="py-2 px-3">
                        {new Date(ref.fechaRef).toLocaleDateString("es-CL")}
                      </td>
                      <td className="py-2 px-3">{ref.codRef ?? "—"}</td>
                      <td className="py-2 px-3">{ref.razonRef ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity Log */}
      {dte.logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de actividad</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dte.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {LOG_ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString("es-CL")}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-muted-foreground text-xs mt-0.5">
                        {log.message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Back */}
      <div className="flex justify-start">
        <Button variant="outline" asChild>
          <Link
            href={
              dte.direction === "EMITTED"
                ? "/invoicing/emitidos"
                : "/invoicing/recibidos"
            }
          >
            Volver a {dte.direction === "EMITTED" ? "emitidos" : "recibidos"}
          </Link>
        </Button>
      </div>

      {/* Void Dialog */}
      <AlertDialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular DTE</AlertDialogTitle>
            <AlertDialogDescription>
              Esta accion es irreversible. Se generara una Nota de Credito que
              anula este documento. Ingrese el motivo de la anulacion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo de anulacion..."
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setVoidReason("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={!voidReason.trim() || voidLoading}
              onClick={handleVoid}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {voidLoading ? "Anulando..." : "Confirmar anulacion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
