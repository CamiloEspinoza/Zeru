"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";

// ─── Constants ────────────────────────────────────

const DTE_TYPE_OPTIONS = [
  { value: "FACTURA_ELECTRONICA", label: "Factura Electronica (33)" },
  {
    value: "FACTURA_EXENTA_ELECTRONICA",
    label: "Factura Exenta Electronica (34)",
  },
  { value: "BOLETA_ELECTRONICA", label: "Boleta Electronica (39)" },
  { value: "BOLETA_EXENTA_ELECTRONICA", label: "Boleta Exenta Electronica (41)" },
  {
    value: "NOTA_DEBITO_ELECTRONICA",
    label: "Nota de Debito Electronica (56)",
  },
  {
    value: "NOTA_CREDITO_ELECTRONICA",
    label: "Nota de Credito Electronica (61)",
  },
  {
    value: "GUIA_DESPACHO_ELECTRONICA",
    label: "Guia de Despacho Electronica (52)",
  },
  {
    value: "FACTURA_COMPRA_ELECTRONICA",
    label: "Factura de Compra Electronica (46)",
  },
];

const REQUIRES_REFERENCE = [
  "NOTA_CREDITO_ELECTRONICA",
  "NOTA_DEBITO_ELECTRONICA",
];

const BOLETA_TYPES = [
  "BOLETA_ELECTRONICA",
  "BOLETA_EXENTA_ELECTRONICA",
];

const IVA_RATE = 0.19;

const clpFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
});

// ─── Interfaces ───────────────────────────────────

interface ItemRow {
  key: number;
  itemName: string;
  quantity: string;
  unitPrice: string;
}

interface ReferenceRow {
  key: number;
  tipoDocRef: string;
  folioRef: string;
  fechaRef: string;
  codRef: string;
  razonRef: string;
}

interface ReceptorLookup {
  rut: string;
  razonSocial: string;
  giro: string;
  direccion: string;
  comuna: string;
  ciudad: string;
}

// ─── Component ────────────────────────────────────

export default function NewDtePage() {
  const { tenant } = useTenantContext();
  const router = useRouter();

  // Form state
  const [dteType, setDteType] = useState("FACTURA_ELECTRONICA");
  const [receptorRut, setReceptorRut] = useState("");
  const [receptorRazon, setReceptorRazon] = useState("");
  const [receptorGiro, setReceptorGiro] = useState("");
  const [receptorDir, setReceptorDir] = useState("");
  const [receptorComuna, setReceptorComuna] = useState("");

  const [items, setItems] = useState<ItemRow[]>([
    { key: 1, itemName: "", quantity: "1", unitPrice: "" },
  ]);
  const [nextItemKey, setNextItemKey] = useState(2);

  const [references, setReferences] = useState<ReferenceRow[]>([]);
  const [nextRefKey, setNextRefKey] = useState(1);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBoleta = BOLETA_TYPES.includes(dteType);
  const requiresRef = REQUIRES_REFERENCE.includes(dteType);
  const isExenta =
    dteType === "FACTURA_EXENTA_ELECTRONICA" ||
    dteType === "BOLETA_EXENTA_ELECTRONICA";

  // ─── Calculated totals ──────────────────────────

  const totals = useMemo(() => {
    let neto = 0;
    for (const item of items) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      neto += Math.round(qty * price);
    }
    const iva = isExenta ? 0 : Math.round(neto * IVA_RATE);
    const total = neto + iva;
    return { neto, iva, total };
  }, [items, isExenta]);

  // ─── Item management ────────────────────────────

  const updateItem = useCallback(
    (key: number, field: keyof ItemRow, value: string) => {
      setItems((prev) =>
        prev.map((item) =>
          item.key === key ? { ...item, [field]: value } : item,
        ),
      );
    },
    [],
  );

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { key: nextItemKey, itemName: "", quantity: "1", unitPrice: "" },
    ]);
    setNextItemKey((k) => k + 1);
  };

  const removeItem = (key: number) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.key !== key) : prev));
  };

  // ─── Reference management ──────────────────────

  const addReference = () => {
    setReferences((prev) => [
      ...prev,
      {
        key: nextRefKey,
        tipoDocRef: "33",
        folioRef: "",
        fechaRef: "",
        codRef: "ANULA_DOCUMENTO",
        razonRef: "",
      },
    ]);
    setNextRefKey((k) => k + 1);
  };

  const updateRef = useCallback(
    (key: number, field: keyof ReferenceRow, value: string) => {
      setReferences((prev) =>
        prev.map((ref) =>
          ref.key === key ? { ...ref, [field]: value } : ref,
        ),
      );
    },
    [],
  );

  const removeRef = (key: number) => {
    setReferences((prev) => prev.filter((r) => r.key !== key));
  };

  // ─── Receptor lookup ────────────────────────────

  const handleLookup = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId || !receptorRut.trim()) return;

    setLookupLoading(true);
    setError(null);
    try {
      const res = await api.get<ReceptorLookup>(
        `/dte/receptor/lookup?rut=${encodeURIComponent(receptorRut.trim())}`,
        { tenantId },
      );
      if (res) {
        setReceptorRazon(res.razonSocial || "");
        setReceptorGiro(res.giro || "");
        setReceptorDir(res.direccion || "");
        setReceptorComuna(res.comuna || "");
      }
    } catch (err) {
      setError(
        (err as Error).message ?? "No se encontro informacion del receptor",
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // ─── Submit ─────────────────────────────────────

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      dteType,
      items: items.map((item) => ({
        itemName: item.itemName,
        quantity: parseFloat(item.quantity) || 1,
        unitPrice: parseFloat(item.unitPrice) || 0,
      })),
    };

    if (!isBoleta) {
      payload.receptorRut = receptorRut;
      payload.receptorRazon = receptorRazon;
      if (receptorGiro) payload.receptorGiro = receptorGiro;
      if (receptorDir) payload.receptorDir = receptorDir;
      if (receptorComuna) payload.receptorComuna = receptorComuna;
    }

    if (requiresRef && references.length > 0) {
      payload.references = references.map((ref) => ({
        tipoDocRef: parseInt(ref.tipoDocRef, 10),
        folioRef: parseInt(ref.folioRef, 10),
        fechaRef: ref.fechaRef,
        codRef: ref.codRef || undefined,
        razonRef: ref.razonRef || undefined,
      }));
    }

    return payload;
  };

  const handleSaveDraft = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>(
        "/dte/draft",
        buildPayload(),
        { tenantId },
      );
      router.push(`/invoicing/${res.id}`);
    } catch (err) {
      setError((err as Error).message ?? "Error al guardar borrador");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmit = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ id: string }>(
        "/dte",
        buildPayload(),
        { tenantId },
      );
      router.push(`/invoicing/${res.id}`);
    } catch (err) {
      setError((err as Error).message ?? "Error al emitir DTE");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nueva emision</h1>
        <p className="text-sm text-muted-foreground">
          Crear y emitir un documento tributario electronico.
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-3">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* DTE Type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de documento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-md">
            <Label htmlFor="dteType">Tipo DTE</Label>
            <Select value={dteType} onValueChange={setDteType}>
              <SelectTrigger id="dteType" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DTE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Receptor */}
      {!isBoleta && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receptor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="receptorRut">RUT</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="receptorRut"
                    placeholder="12.345.678-9"
                    value={receptorRut}
                    onChange={(e) => setReceptorRut(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={lookupLoading || !receptorRut.trim()}
                    onClick={handleLookup}
                  >
                    {lookupLoading ? "Buscando..." : "Buscar"}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="receptorRazon">Razon social</Label>
                <Input
                  id="receptorRazon"
                  className="mt-1"
                  value={receptorRazon}
                  onChange={(e) => setReceptorRazon(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="receptorGiro">Giro</Label>
                <Input
                  id="receptorGiro"
                  className="mt-1"
                  value={receptorGiro}
                  onChange={(e) => setReceptorGiro(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="receptorDir">Direccion</Label>
                <Input
                  id="receptorDir"
                  className="mt-1"
                  value={receptorDir}
                  onChange={(e) => setReceptorDir(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="receptorComuna">Comuna</Label>
                <Input
                  id="receptorComuna"
                  className="mt-1"
                  value={receptorComuna}
                  onChange={(e) => setReceptorComuna(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Detalle de items</CardTitle>
          <Button variant="outline" size="sm" onClick={addItem}>
            Agregar item
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium w-[40%]">
                    Nombre
                  </th>
                  <th className="text-right py-2 px-2 font-medium w-[15%]">
                    Cantidad
                  </th>
                  <th className="text-right py-2 px-2 font-medium w-[20%]">
                    Precio Unit.
                  </th>
                  <th className="text-right py-2 px-2 font-medium w-[15%]">
                    Total
                  </th>
                  <th className="w-[10%]" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const qty = parseFloat(item.quantity) || 0;
                  const price = parseFloat(item.unitPrice) || 0;
                  const lineTotal = Math.round(qty * price);
                  return (
                    <tr key={item.key} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        <Input
                          placeholder="Nombre del item"
                          value={item.itemName}
                          onChange={(e) =>
                            updateItem(item.key, "itemName", e.target.value)
                          }
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          className="text-right"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(item.key, "quantity", e.target.value)
                          }
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          className="text-right"
                          placeholder="0"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItem(item.key, "unitPrice", e.target.value)
                          }
                        />
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-medium">
                        {clpFormatter.format(lineTotal)}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => removeItem(item.key)}
                          disabled={items.length <= 1}
                        >
                          Quitar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end mt-4">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Neto</span>
                <span className="tabular-nums">
                  {clpFormatter.format(totals.neto)}
                </span>
              </div>
              {!isExenta && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA (19%)</span>
                  <span className="tabular-nums">
                    {clpFormatter.format(totals.iva)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">
                  {clpFormatter.format(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* References (NC/ND only) */}
      {requiresRef && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Referencias al documento original
            </CardTitle>
            <Button variant="outline" size="sm" onClick={addReference}>
              Agregar referencia
            </Button>
          </CardHeader>
          <CardContent>
            {references.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Las notas de credito y debito requieren al menos una referencia.
                Haz clic en &quot;Agregar referencia&quot;.
              </p>
            ) : (
              <div className="space-y-4">
                {references.map((ref) => (
                  <div
                    key={ref.key}
                    className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border rounded-lg"
                  >
                    <div>
                      <Label className="text-xs">Tipo doc. ref.</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        placeholder="33"
                        value={ref.tipoDocRef}
                        onChange={(e) =>
                          updateRef(ref.key, "tipoDocRef", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Folio ref.</Label>
                      <Input
                        type="number"
                        className="mt-1"
                        placeholder="123"
                        value={ref.folioRef}
                        onChange={(e) =>
                          updateRef(ref.key, "folioRef", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Fecha ref.</Label>
                      <Input
                        type="date"
                        className="mt-1"
                        value={ref.fechaRef}
                        onChange={(e) =>
                          updateRef(ref.key, "fechaRef", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Codigo</Label>
                      <Select
                        value={ref.codRef}
                        onValueChange={(v) => updateRef(ref.key, "codRef", v)}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ANULA_DOCUMENTO">
                            Anula documento
                          </SelectItem>
                          <SelectItem value="CORRIGE_TEXTO">
                            Corrige texto
                          </SelectItem>
                          <SelectItem value="CORRIGE_MONTOS">
                            Corrige montos
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Label className="text-xs">Razon</Label>
                        <Input
                          className="mt-1"
                          placeholder="Razon de la referencia"
                          value={ref.razonRef}
                          onChange={(e) =>
                            updateRef(ref.key, "razonRef", e.target.value)
                          }
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-9"
                        onClick={() => removeRef(ref.key)}
                      >
                        Quitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => router.push("/invoicing/emitidos")}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={submitting}
        >
          {submitting ? "Guardando..." : "Guardar borrador"}
        </Button>
        <Button onClick={handleEmit} disabled={submitting}>
          {submitting ? "Emitiendo..." : "Emitir"}
        </Button>
      </div>
    </div>
  );
}
