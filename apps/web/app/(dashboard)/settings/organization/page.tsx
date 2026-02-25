"use client";

import { useState, useEffect } from "react";
import { useTenantContext } from "@/providers/tenant-provider";
import { api } from "@/lib/api-client";
import type { UpdateTenantInput } from "@zeru/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function TenantIdField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 font-mono text-xs bg-muted border rounded px-3 py-2 select-all break-all">
        {value}
      </code>
      <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
        {copied ? "¡Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const { tenant } = useTenantContext();
  const [formData, setFormData] = useState<UpdateTenantInput>({
    name: tenant?.name ?? "",
    rut: tenant?.rut ?? "",
    address: tenant?.address ?? "",
    phone: tenant?.phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name ?? "",
        rut: tenant.rut ?? "",
        address: tenant.address ?? "",
        phone: tenant.phone ?? "",
      });
    }
  }, [tenant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    setSaving(true);
    setSuccess(false);

    try {
      await api.patch("/tenants/current", formData, {
        tenantId: tenant.id,
      });
      setSuccess(true);
    } catch {
      // Error handling could be improved with toast
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Organización</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Organización</h1>

      <Card>
        <CardHeader>
          <CardTitle>Datos de la organización</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={formData.name ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Nombre de la empresa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rut">RUT</Label>
              <Input
                id="rut"
                value={formData.rut ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, rut: e.target.value }))
                }
                placeholder="12.345.678-9"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, address: e.target.value }))
                }
                placeholder="Dirección"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+56 9 1234 5678"
              />
            </div>

            {success && (
              <p className="text-sm text-green-600 dark:text-green-400">
                Configuración guardada correctamente.
              </p>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Identificadores de la organización</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Tenant ID</p>
            <p className="text-xs text-muted-foreground mb-2">
              Úsalo como header <code className="font-mono bg-muted px-1 rounded">X-Tenant-Id</code> al hacer llamadas a la API pública.
            </p>
            <TenantIdField value={tenant.id} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
