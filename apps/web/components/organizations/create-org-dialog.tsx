"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";
import { useAuthContext } from "@/providers/auth-provider";
import type { Tenant, AuthTokens } from "@zeru/shared";
import { storeTokens } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

interface CreateOrgDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateOrgDialog({ open, onOpenChange }: CreateOrgDialogProps) {
  const { switchTenant } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  function reset() {
    setName("");
    setSlug("");
    setSlugTouched(false);
    setError("");
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const tenant = await api.post<Tenant>("/tenants", { name, slug });
      // Switch to the newly created organization
      await switchTenant(tenant.id);
    } catch (err) {
      setError((err as Error).message || "Error al crear organización");
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva organización</DialogTitle>
            <DialogDescription>
              Crea una nueva organización. Serás agregado como propietario
              automáticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">Nombre</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                minLength={2}
                placeholder="Mi Empresa"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-slug">Identificador (slug)</Label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                required
                minLength={2}
                pattern="^[a-z0-9-]+$"
                placeholder="mi-empresa"
              />
              <p className="text-muted-foreground text-xs">
                Solo minúsculas, números y guiones.
              </p>
            </div>

            {error && (
              <p className="text-destructive text-xs">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Creando..." : "Crear organización"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
