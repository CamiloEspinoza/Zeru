"use client";

import { useState, useEffect } from "react";
import { useTenantContext } from "@/providers/tenant-provider";
import { api } from "@/lib/api-client";
import { brandingApi } from "@/lib/api/branding";
import type { UpdateTenantInput, TenantBranding } from "@zeru/shared";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImageUploadZone } from "@/components/branding/image-upload-zone";
import { ThemeEditor } from "@/components/branding/theme-editor";

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
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="shrink-0"
      >
        {copied ? "¡Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}

function AppearanceTab() {
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingFavicon, setGeneratingFavicon] = useState(false);

  useEffect(() => {
    brandingApi.get().then((data) => {
      setBranding(data);
      setLoading(false);
    });
  }, []);

  const refreshBranding = async () => {
    const data = await brandingApi.get();
    setBranding(data);
  };

  const handleUpload = async (
    type: "logo" | "isotipo" | "favicon",
    file: File,
  ) => {
    const methods = {
      logo: brandingApi.uploadLogo,
      isotipo: brandingApi.uploadIsotipo,
      favicon: brandingApi.uploadFavicon,
    };
    await methods[type](file);
    await refreshBranding();
  };

  const handleDelete = async (type: "logo" | "isotipo" | "favicon") => {
    const methods = {
      logo: brandingApi.deleteLogo,
      isotipo: brandingApi.deleteIsotipo,
      favicon: brandingApi.deleteFavicon,
    };
    await methods[type]();
    await refreshBranding();
  };

  const handleFaviconFromIsotipo = async () => {
    setGeneratingFavicon(true);
    try {
      await brandingApi.setFaviconFromIsotipo();
      await refreshBranding();
    } finally {
      setGeneratingFavicon(false);
    }
  };

  const handleGenerateFavicon = async () => {
    setGeneratingFavicon(true);
    try {
      await brandingApi.generateFavicon();
      await refreshBranding();
    } finally {
      setGeneratingFavicon(false);
    }
  };

  if (loading)
    return <div className="text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-6">
      {/* Logo & Isotipo */}
      <Card>
        <CardHeader>
          <CardTitle>Logotipo e Isotipo</CardTitle>
          <p className="text-sm text-muted-foreground">
            El logotipo se usa en correos y reportes. El isotipo se muestra en
            el menú lateral.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 items-stretch">
            <ImageUploadZone
              label="Logotipo"
              hint="PNG, SVG o JPG. Max 2MB. Recomendado: 400x120px"
              currentUrl={branding?.logoUrl ?? null}
              onUpload={(file) => handleUpload("logo", file)}
              onDelete={() => handleDelete("logo")}
              className="flex-1"
            />
            <ImageUploadZone
              label="Isotipo"
              hint="Cuadrado. Max 1MB. 128x128px"
              currentUrl={branding?.isotipoUrl ?? null}
              onUpload={(file) => handleUpload("isotipo", file)}
              onDelete={() => handleDelete("isotipo")}
              className="w-[200px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Favicon */}
      <Card>
        <CardHeader>
          <CardTitle>Favicon</CardTitle>
          <p className="text-sm text-muted-foreground">
            El icono que aparece en la pestana del navegador.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-6 items-start">
            <ImageUploadZone
              label="Favicon"
              hint="PNG o ICO. Max 1MB. 32x32px recomendado"
              currentUrl={branding?.faviconUrl ?? null}
              onUpload={(file) => handleUpload("favicon", file)}
              onDelete={() => handleDelete("favicon")}
              className="w-[200px]"
            />
            <div className="flex flex-col gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleFaviconFromIsotipo}
                disabled={generatingFavicon || !branding?.isotipoUrl}
              >
                Usar isotipo
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateFavicon}
                disabled={
                  generatingFavicon ||
                  (!branding?.logoUrl && !branding?.isotipoUrl)
                }
              >
                {generatingFavicon ? "Generando..." : "Generar con IA"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card>
        <CardHeader>
          <CardTitle>Paleta de colores</CardTitle>
          <p className="text-sm text-muted-foreground">
            Define el color principal. Se generan automaticamente todos los
            colores del sistema para light y dark mode.
          </p>
        </CardHeader>
        <CardContent>
          <ThemeEditor
            branding={branding}
            logoUrl={branding?.logoUrl ?? null}
            onSaved={refreshBranding}
          />
        </CardContent>
      </Card>
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
      <h1 className="text-2xl font-bold">Organizacion</h1>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">Datos generales</TabsTrigger>
          <TabsTrigger value="appearance">Apariencia</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
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
                      setFormData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
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
                      setFormData((prev) => ({
                        ...prev,
                        rut: e.target.value,
                      }))
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
                      setFormData((prev) => ({
                        ...prev,
                        address: e.target.value,
                      }))
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
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
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
                  Usalo como header{" "}
                  <code className="font-mono bg-muted px-1 rounded">
                    X-Tenant-Id
                  </code>{" "}
                  al hacer llamadas a la API pública.
                </p>
                <TenantIdField value={tenant.id} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6">
          <AppearanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
