"use client";

import { useState, useEffect, useRef } from "react";
import { dteApi, type DteFolio } from "@/lib/api/dte";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

const DTE_TYPE_LABELS: Record<string, string> = {
  FACTURA_ELECTRONICA: "Factura Electronica",
  FACTURA_EXENTA_ELECTRONICA: "Factura Exenta Electronica",
  BOLETA_ELECTRONICA: "Boleta Electronica",
  BOLETA_EXENTA_ELECTRONICA: "Boleta Exenta Electronica",
  LIQUIDACION_FACTURA_ELECTRONICA: "Liquidacion-Factura Electronica",
  FACTURA_COMPRA_ELECTRONICA: "Factura de Compra Electronica",
  GUIA_DESPACHO_ELECTRONICA: "Guia de Despacho Electronica",
  NOTA_DEBITO_ELECTRONICA: "Nota de Debito Electronica",
  NOTA_CREDITO_ELECTRONICA: "Nota de Credito Electronica",
};

function envLabel(env: string) {
  return env === "PRODUCTION" ? "Produccion" : "Certificacion";
}

function folioConsumption(folio: DteFolio) {
  const total = folio.rangeTo - folio.rangeFrom + 1;
  const used = folio.nextFolio - folio.rangeFrom;
  return total > 0 ? Math.round((used / total) * 100) : 100;
}

function folioRemaining(folio: DteFolio) {
  return folio.rangeTo - folio.nextFolio + 1;
}

export default function FoliosPage() {
  const [folios, setFolios] = useState<DteFolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchFolios = () => {
    setLoading(true);
    dteApi
      .listFolios()
      .then((data) => setFolios(Array.isArray(data) ? data : []))
      .catch(() => setFolios([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchFolios();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Seleccione un archivo CAF (.xml)");
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      await dteApi.uploadCaf(text);
      toast.success("CAF cargado correctamente");
      if (fileRef.current) fileRef.current.value = "";
      fetchFolios();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al cargar CAF",
      );
    } finally {
      setUploading(false);
    }
  };

  const lowStockFolios = folios.filter(
    (f) =>
      !f.isExhausted &&
      f.isActive &&
      folioRemaining(f) <= f.alertThreshold,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Folios CAF</h1>

      {/* ── Low stock alert ── */}
      {lowStockFolios.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            {lowStockFolios.length === 1
              ? "Hay 1 rango de folios con stock bajo."
              : `Hay ${lowStockFolios.length} rangos de folios con stock bajo.`}{" "}
            Suba nuevos archivos CAF para evitar interrupciones.
          </AlertDescription>
        </Alert>
      )}

      {/* ── Upload ── */}
      <Card>
        <CardHeader>
          <CardTitle>Subir archivo CAF</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="caf-file">Archivo CAF (.xml)</Label>
              <Input
                id="caf-file"
                type="file"
                accept=".xml"
                ref={fileRef}
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Cargando..." : "Subir CAF"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Archivo XML de autorizacion de folios descargado desde el SII
          </p>
        </CardContent>
      </Card>

      {/* ── Table ── */}
      <Card>
        <CardHeader>
          <CardTitle>Rangos de folios</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : folios.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay folios cargados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo DTE</TableHead>
                  <TableHead>Ambiente</TableHead>
                  <TableHead>Rango</TableHead>
                  <TableHead>Siguiente</TableHead>
                  <TableHead>Restantes</TableHead>
                  <TableHead className="w-[180px]">Uso</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {folios.map((folio) => {
                  const pct = folioConsumption(folio);
                  const remaining = folioRemaining(folio);
                  const isLow =
                    !folio.isExhausted &&
                    folio.isActive &&
                    remaining <= folio.alertThreshold;
                  return (
                    <TableRow
                      key={folio.id}
                      className={isLow ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                    >
                      <TableCell className="font-medium">
                        {DTE_TYPE_LABELS[folio.dteType] ?? folio.dteType}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            folio.environment === "PRODUCTION"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {envLabel(folio.environment)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {folio.rangeFrom} - {folio.rangeTo}
                      </TableCell>
                      <TableCell>{folio.nextFolio}</TableCell>
                      <TableCell>
                        {folio.isExhausted ? (
                          <span className="text-muted-foreground">0</span>
                        ) : (
                          remaining
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1" />
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {folio.isExhausted ? (
                          <Badge variant="destructive">Agotado</Badge>
                        ) : !folio.isActive ? (
                          <Badge variant="secondary">Inactivo</Badge>
                        ) : isLow ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600"
                          >
                            Stock bajo
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-600"
                          >
                            Activo
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
