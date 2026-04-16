"use client";

import { useState, useEffect } from "react";
import { dteApi, type DteAccountMapping } from "@/lib/api/dte";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const DIRECTION_LABELS: Record<string, string> = {
  EMITTED: "Emitido",
  RECEIVED: "Recibido",
};

const ACCOUNT_FIELDS_EMITTED: {
  key: keyof DteAccountMapping;
  label: string;
}[] = [
  { key: "receivableAccountId", label: "Cuentas por Cobrar" },
  { key: "revenueAccountId", label: "Ventas" },
  { key: "revenueExemptAccountId", label: "Ventas Exentas" },
  { key: "ivaDebitoAccountId", label: "IVA Debito Fiscal" },
  { key: "cashAccountId", label: "Caja" },
  { key: "salesReturnAccountId", label: "Devolucion Ventas" },
];

const ACCOUNT_FIELDS_RECEIVED: {
  key: keyof DteAccountMapping;
  label: string;
}[] = [
  { key: "payableAccountId", label: "Cuentas por Pagar" },
  { key: "purchaseAccountId", label: "Compras" },
  { key: "ivaCreditoAccountId", label: "IVA Credito Fiscal" },
  { key: "cashAccountId", label: "Caja" },
  { key: "purchaseReturnAccountId", label: "Devolucion Compras" },
];

function getAccountFields(direction: string) {
  return direction === "EMITTED"
    ? ACCOUNT_FIELDS_EMITTED
    : ACCOUNT_FIELDS_RECEIVED;
}

function configuredCount(mapping: DteAccountMapping, direction: string) {
  const fields = getAccountFields(direction);
  return fields.filter(
    (f) => mapping[f.key] != null && mapping[f.key] !== "",
  ).length;
}

export default function AccountMappingsPage() {
  const [mappings, setMappings] = useState<DteAccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [editingMapping, setEditingMapping] =
    useState<DteAccountMapping | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchMappings = () => {
    setLoading(true);
    dteApi
      .listMappings()
      .then((data) => setMappings(Array.isArray(data) ? data : []))
      .catch(() => setMappings([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMappings();
  }, []);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await dteApi.seedMappings();
      toast.success("Configuracion por defecto creada");
      fetchMappings();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al crear configuracion por defecto",
      );
    } finally {
      setSeeding(false);
    }
  };

  const openEdit = (mapping: DteAccountMapping) => {
    const fields = getAccountFields(mapping.direction);
    const form: Record<string, string> = {};
    for (const field of fields) {
      form[field.key] = (mapping[field.key] as string) ?? "";
    }
    setEditForm(form);
    setEditingMapping(mapping);
  };

  const handleSave = async () => {
    if (!editingMapping) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        dteTypeCode: editingMapping.dteTypeCode,
        direction: editingMapping.direction,
      };
      const fields = getAccountFields(editingMapping.direction);
      for (const field of fields) {
        payload[field.key] = editForm[field.key]?.trim() || null;
      }
      await dteApi.upsertMapping(
        payload as Parameters<typeof dteApi.upsertMapping>[0],
      );
      toast.success("Mapeo actualizado");
      setEditingMapping(null);
      fetchMappings();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar mapeo",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mapeo de Cuentas Contables</h1>
        <Button
          variant="outline"
          onClick={handleSeed}
          disabled={seeding || mappings.length > 0}
        >
          {seeding ? "Creando..." : "Crear configuracion por defecto"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tipos DTE y cuentas asociadas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Configure las cuentas contables que se usaran al crear asientos
            automaticos para cada tipo de DTE.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : mappings.length === 0 ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-muted-foreground">
                No hay mapeos configurados
              </p>
              <Button onClick={handleSeed} disabled={seeding}>
                {seeding ? "Creando..." : "Crear configuracion por defecto"}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo DTE</TableHead>
                  <TableHead>Direccion</TableHead>
                  <TableHead>CxC / CxP</TableHead>
                  <TableHead>Ventas / Compras</TableHead>
                  <TableHead>IVA DF / CF</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mappings.map((mapping) => {
                  const isEmitted = mapping.direction === "EMITTED";
                  const fields = getAccountFields(mapping.direction);
                  const configured = configuredCount(
                    mapping,
                    mapping.direction,
                  );
                  const total = fields.length;
                  const cxKey = isEmitted
                    ? "receivableAccountId"
                    : "payableAccountId";
                  const saleKey = isEmitted
                    ? "revenueAccountId"
                    : "purchaseAccountId";
                  const ivaKey = isEmitted
                    ? "ivaDebitoAccountId"
                    : "ivaCreditoAccountId";

                  return (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {mapping.dteTypeName}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isEmitted ? "default" : "secondary"}
                        >
                          {DIRECTION_LABELS[mapping.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {mapping[cxKey as keyof DteAccountMapping] ? (
                          <span className="text-xs font-mono truncate max-w-[120px] block">
                            {String(
                              mapping[cxKey as keyof DteAccountMapping],
                            ).slice(0, 8)}
                            ...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin configurar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mapping[saleKey as keyof DteAccountMapping] ? (
                          <span className="text-xs font-mono truncate max-w-[120px] block">
                            {String(
                              mapping[saleKey as keyof DteAccountMapping],
                            ).slice(0, 8)}
                            ...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin configurar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {mapping[ivaKey as keyof DteAccountMapping] ? (
                          <span className="text-xs font-mono truncate max-w-[120px] block">
                            {String(
                              mapping[ivaKey as keyof DteAccountMapping],
                            ).slice(0, 8)}
                            ...
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Sin configurar
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {configured === total ? (
                          <Badge
                            variant="outline"
                            className="border-green-500 text-green-600"
                          >
                            Completo
                          </Badge>
                        ) : configured > 0 ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500 text-amber-600"
                          >
                            {configured}/{total}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Sin configurar
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(mapping)}
                        >
                          Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Edit dialog ── */}
      <Dialog
        open={editingMapping !== null}
        onOpenChange={(open) => !open && setEditingMapping(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Editar mapeo -{" "}
              {editingMapping?.dteTypeName ?? ""}{" "}
              ({DIRECTION_LABELS[editingMapping?.direction ?? "EMITTED"]})
            </DialogTitle>
          </DialogHeader>

          {editingMapping && (
            <div className="space-y-4">
              {getAccountFields(editingMapping.direction).map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`edit-${field.key}`}
                    value={editForm[field.key] ?? ""}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder="ID de cuenta contable"
                    className="font-mono text-sm"
                  />
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingMapping(null)}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
