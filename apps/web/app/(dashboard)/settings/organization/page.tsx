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
    </div>
  );
}
