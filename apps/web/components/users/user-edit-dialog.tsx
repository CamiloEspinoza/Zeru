"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { UserInTenant, RoleInfo } from "@zeru/shared";
import { USER_ROLES } from "@zeru/shared";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  ACCOUNTANT: "Contador",
  VIEWER: "Solo lectura",
};

interface UserEditDialogProps {
  user: UserInTenant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  roles?: RoleInfo[];
}

export function UserEditDialog({
  user,
  open,
  onOpenChange,
  onSaved,
  roles = [],
}: UserEditDialogProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<string>("VIEWER");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Sync form state when the dialog opens with a user
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
      setRole(user.roleRef?.slug.toUpperCase() ?? user.role);
      setIsActive(user.isActive);
      setError("");
    }
  }, [user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      // Determine the original role value for comparison
      const originalRole = user.roleRef?.slug.toUpperCase() ?? user.role;

      // Run user update and role update in parallel when needed
      const promises: Promise<unknown>[] = [
        api.patch(`/users/${user.id}`, {
          firstName,
          lastName,
          isActive,
        }),
      ];

      if (role !== originalRole) {
        promises.push(api.patch(`/users/${user.id}/role`, { role }));
      }

      await Promise.all(promises);

      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError((err as Error).message || "Error al guardar cambios");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Modifica los datos del usuario en tu organización.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-firstName">Nombre</Label>
                <Input
                  id="edit-firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Juan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-lastName">Apellido</Label>
                <Input
                  id="edit-lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="Pérez"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={user?.email ?? ""}
                readOnly
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-role">Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.length > 0
                    ? roles.map((r) => (
                        <SelectItem key={r.slug} value={r.slug.toUpperCase()}>
                          {r.name}
                        </SelectItem>
                      ))
                    : USER_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {ROLE_LABELS[r] ?? r}
                        </SelectItem>
                      ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="edit-isActive" className="cursor-pointer">
                  Estado
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isActive ? "Activo" : "Inactivo"}
                </p>
              </div>
              <Switch
                id="edit-isActive"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            {error && <p className="text-destructive text-xs">{error}</p>}
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
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
