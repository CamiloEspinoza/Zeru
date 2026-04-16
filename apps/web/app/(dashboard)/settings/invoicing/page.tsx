"use client";

import { useState, useEffect } from "react";
import { dteApi, type DteConfig, type DteConfigInput } from "@/lib/api/dte";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const EMPTY_FORM: DteConfigInput = {
  rut: "",
  razonSocial: "",
  giro: "",
  actividadEco: 0,
  direccion: "",
  comuna: "",
  ciudad: "",
  environment: "CERTIFICATION",
  resolutionNum: 0,
  resolutionDate: "",
  exchangeEmail: "",
  imapHost: "",
  imapPort: 993,
  imapUser: "",
  imapPass: "",
  imapEnabled: false,
  autoCreateJournalEntry: true,
  autoPostJournalEntry: false,
};

function configToForm(config: DteConfig): DteConfigInput {
  return {
    rut: config.rut,
    razonSocial: config.razonSocial,
    giro: config.giro,
    actividadEco: config.actividadEco,
    direccion: config.direccion,
    comuna: config.comuna,
    ciudad: config.ciudad,
    codigoSucursal: config.codigoSucursal ?? undefined,
    environment: config.environment,
    resolutionNum: config.resolutionNum,
    resolutionDate: config.resolutionDate
      ? config.resolutionDate.slice(0, 10)
      : "",
    exchangeEmail: config.exchangeEmail ?? "",
    imapHost: config.imapHost ?? "",
    imapPort: config.imapPort ?? 993,
    imapUser: config.imapUser ?? "",
    imapPass: config.imapPass ?? "",
    imapEnabled: config.imapEnabled,
    autoCreateJournalEntry: config.autoCreateJournalEntry,
    autoPostJournalEntry: config.autoPostJournalEntry,
  };
}

export default function InvoicingSettingsPage() {
  const [form, setForm] = useState<DteConfigInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showImap, setShowImap] = useState(false);

  useEffect(() => {
    dteApi
      .getConfig()
      .then((config) => {
        if (config) {
          const formData = configToForm(config);
          setForm(formData);
          setShowImap(config.imapEnabled);
        }
      })
      .catch(() => {
        // No config yet — keep empty form
      })
      .finally(() => setLoading(false));
  }, []);

  const setField = <K extends keyof DteConfigInput>(
    key: K,
    value: DteConfigInput[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: DteConfigInput = {
        ...form,
        actividadEco: Number(form.actividadEco),
        resolutionNum: Number(form.resolutionNum),
        imapPort: Number(form.imapPort),
      };
      const updated = await dteApi.upsertConfig(payload);
      setForm(configToForm(updated));
      toast.success("Configuracion guardada correctamente");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar configuracion",
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Facturacion Electronica</h1>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturacion Electronica</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── Datos del Emisor ── */}
        <Card>
          <CardHeader>
            <CardTitle>Datos del Emisor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT</Label>
                <Input
                  id="rut"
                  value={form.rut}
                  onChange={(e) => setField("rut", e.target.value)}
                  placeholder="76.123.456-7"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="razonSocial">Razon Social</Label>
                <Input
                  id="razonSocial"
                  value={form.razonSocial}
                  onChange={(e) => setField("razonSocial", e.target.value)}
                  placeholder="Mi Empresa SpA"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="giro">Giro</Label>
                <Input
                  id="giro"
                  value={form.giro}
                  onChange={(e) => setField("giro", e.target.value)}
                  placeholder="Servicios de tecnologia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actividadEco">Actividad Economica</Label>
                <Input
                  id="actividadEco"
                  type="number"
                  value={form.actividadEco || ""}
                  onChange={(e) =>
                    setField("actividadEco", Number(e.target.value))
                  }
                  placeholder="620200"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="direccion">Direccion</Label>
                <Input
                  id="direccion"
                  value={form.direccion}
                  onChange={(e) => setField("direccion", e.target.value)}
                  placeholder="Av. Providencia 1234"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comuna">Comuna</Label>
                <Input
                  id="comuna"
                  value={form.comuna}
                  onChange={(e) => setField("comuna", e.target.value)}
                  placeholder="Providencia"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciudad">Ciudad</Label>
                <Input
                  id="ciudad"
                  value={form.ciudad}
                  onChange={(e) => setField("ciudad", e.target.value)}
                  placeholder="Santiago"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Configuracion SII ── */}
        <Card>
          <CardHeader>
            <CardTitle>Configuracion SII</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resolutionNum">Numero de Resolucion</Label>
                <Input
                  id="resolutionNum"
                  type="number"
                  value={form.resolutionNum || ""}
                  onChange={(e) =>
                    setField("resolutionNum", Number(e.target.value))
                  }
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolutionDate">Fecha de Resolucion</Label>
                <Input
                  id="resolutionDate"
                  type="date"
                  value={form.resolutionDate}
                  onChange={(e) => setField("resolutionDate", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Ambiente</Label>
                <Select
                  value={form.environment}
                  onValueChange={(v) =>
                    setField(
                      "environment",
                      v as "CERTIFICATION" | "PRODUCTION",
                    )
                  }
                >
                  <SelectTrigger id="environment">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CERTIFICATION">
                      Certificacion
                    </SelectItem>
                    <SelectItem value="PRODUCTION">Produccion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="exchangeEmail">Email de intercambio</Label>
              <Input
                id="exchangeEmail"
                type="email"
                value={form.exchangeEmail ?? ""}
                onChange={(e) => setField("exchangeEmail", e.target.value)}
                placeholder="dte@miempresa.cl"
              />
              <p className="text-xs text-muted-foreground">
                Correo registrado en SII para intercambio de DTE
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── IMAP ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recepcion IMAP</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="imap-toggle" className="text-sm font-normal">
                  {showImap ? "Configurado" : "Desactivado"}
                </Label>
                <Switch
                  id="imap-toggle"
                  checked={showImap}
                  onCheckedChange={(checked) => {
                    setShowImap(checked);
                    setField("imapEnabled", checked);
                  }}
                />
              </div>
            </div>
          </CardHeader>
          {showImap && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imapHost">Host IMAP</Label>
                  <Input
                    id="imapHost"
                    value={form.imapHost ?? ""}
                    onChange={(e) => setField("imapHost", e.target.value)}
                    placeholder="imap.gmail.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imapPort">Puerto</Label>
                  <Input
                    id="imapPort"
                    type="number"
                    value={form.imapPort ?? 993}
                    onChange={(e) =>
                      setField("imapPort", Number(e.target.value))
                    }
                    placeholder="993"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="imapUser">Usuario</Label>
                  <Input
                    id="imapUser"
                    value={form.imapUser ?? ""}
                    onChange={(e) => setField("imapUser", e.target.value)}
                    placeholder="dte@miempresa.cl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="imapPass">Contrasena</Label>
                  <Input
                    id="imapPass"
                    type="password"
                    value={form.imapPass ?? ""}
                    onChange={(e) => setField("imapPass", e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="imapEnabled"
                  checked={form.imapEnabled ?? false}
                  onCheckedChange={(checked) =>
                    setField("imapEnabled", checked)
                  }
                />
                <Label htmlFor="imapEnabled" className="font-normal">
                  Habilitar recepcion automatica por IMAP
                </Label>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Contabilidad ── */}
        <Card>
          <CardHeader>
            <CardTitle>Opciones de contabilidad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Crear asiento contable automaticamente
                </p>
                <p className="text-xs text-muted-foreground">
                  Al emitir o recibir un DTE se crea el asiento de forma
                  automatica
                </p>
              </div>
              <Switch
                checked={form.autoCreateJournalEntry ?? true}
                onCheckedChange={(checked) =>
                  setField("autoCreateJournalEntry", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Contabilizar asiento automaticamente
                </p>
                <p className="text-xs text-muted-foreground">
                  El asiento creado se contabiliza sin revision manual
                </p>
              </div>
              <Switch
                checked={form.autoPostJournalEntry ?? false}
                onCheckedChange={(checked) =>
                  setField("autoPostJournalEntry", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Guardar ── */}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuracion"}
          </Button>
        </div>
      </form>
    </div>
  );
}
