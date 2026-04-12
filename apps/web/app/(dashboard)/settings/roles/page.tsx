"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  MODULE_DEFINITIONS,
  type AccessLevel,
  type ModuleDefinition,
  type SidebarSection,
} from "@zeru/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

// ── Types ──

interface Role {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isDefault: boolean;
  _count?: { members: number };
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[];
  overrides: { permission: string; granted: boolean }[];
}

// ── Constants ──

const SECTION_LABELS: Record<string, string> = {
  core: "Core",
  business: "Negocio",
  people: "Personas",
  laboratory: "Laboratorio",
  marketing: "Marketing",
  system: "Sistema",
};

const ACCESS_LEVELS: { value: AccessLevel; label: string }[] = [
  { value: "NONE", label: "Sin acceso" },
  { value: "VIEW", label: "Ver" },
  { value: "EDIT", label: "Editar" },
  { value: "MANAGE", label: "Admin" },
];

const LEVEL_HIERARCHY: Record<AccessLevel, number> = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  MANAGE: 3,
};

// ── Helpers ──

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function groupBySection(modules: ModuleDefinition[]) {
  const sections: { section: SidebarSection; modules: ModuleDefinition[] }[] =
    [];
  const seen = new Set<string>();
  for (const mod of modules) {
    if (!seen.has(mod.section)) {
      seen.add(mod.section);
      sections.push({
        section: mod.section,
        modules: modules.filter((m) => m.section === mod.section),
      });
    }
  }
  return sections;
}

const MODULE_SECTIONS = groupBySection(MODULE_DEFINITIONS);

function getModuleAccess(
  moduleAccess: { moduleKey: string; accessLevel: AccessLevel }[],
  moduleKey: string,
): AccessLevel {
  return (
    moduleAccess.find((a) => a.moduleKey === moduleKey)?.accessLevel ?? "NONE"
  );
}

function isPermissionIncludedByLevel(
  minLevel: AccessLevel,
  currentLevel: AccessLevel,
): boolean {
  return LEVEL_HIERARCHY[currentLevel] >= LEVEL_HIERARCHY[minLevel];
}

function emptyRole(): Omit<Role, "id"> {
  return {
    name: "",
    slug: "",
    description: null,
    isSystem: false,
    isDefault: false,
    moduleAccess: MODULE_DEFINITIONS.map((m) => ({
      moduleKey: m.key,
      accessLevel: "NONE" as AccessLevel,
    })),
    overrides: [],
  };
}

// ── Component ──

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<
    (Omit<Role, "id"> & { id?: string }) | null
  >(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fetchRoles = useCallback(() => {
    setLoading(true);
    api
      .get<Role[]>("/roles")
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => setRoles([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    Promise.resolve().then(fetchRoles);
  }, [fetchRoles]);

  // ── Role CRUD ──

  function openCreate() {
    setEditingRole(emptyRole());
    setEditorOpen(true);
  }

  function openEdit(role: Role) {
    setEditingRole({
      ...role,
      moduleAccess: MODULE_DEFINITIONS.map((m) => ({
        moduleKey: m.key,
        accessLevel: getModuleAccess(role.moduleAccess ?? [], m.key),
      })),
    });
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingRole(null);
  }

  async function saveRole() {
    if (!editingRole) return;
    if (!editingRole.name.trim()) {
      toast.error("El nombre del rol es obligatorio");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: editingRole.name,
        slug: editingRole.slug || toSlug(editingRole.name),
        description: editingRole.description,
        isDefault: editingRole.isDefault,
        moduleAccess: editingRole.moduleAccess,
        overrides: editingRole.overrides,
      };
      if (editingRole.id) {
        await api.patch(`/roles/${editingRole.id}`, payload);
        toast.success("Rol actualizado");
      } else {
        await api.post("/roles", payload);
        toast.success("Rol creado");
      }
      closeEditor();
      fetchRoles();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al guardar el rol",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRole(id: string) {
    try {
      await api.delete(`/roles/${id}`);
      toast.success("Rol eliminado");
      setDeleteConfirmId(null);
      fetchRoles();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar el rol",
      );
    }
  }

  // ── Editor state helpers ──

  function setField<K extends keyof Role>(key: K, value: Role[K]) {
    setEditingRole((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function setAllModulesLevel(level: AccessLevel) {
    setEditingRole((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        moduleAccess: prev.moduleAccess.map((a) => ({
          ...a,
          accessLevel: level,
        })),
      };
    });
  }

  function setModuleLevel(moduleKey: string, level: AccessLevel) {
    setEditingRole((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        moduleAccess: prev.moduleAccess.map((a) =>
          a.moduleKey === moduleKey ? { ...a, accessLevel: level } : a,
        ),
      };
    });
  }

  function toggleOverride(
    moduleKey: string,
    permKey: string,
    minLevel: AccessLevel,
    currentModuleLevel: AccessLevel,
  ) {
    setEditingRole((prev) => {
      if (!prev) return prev;
      const fullKey = `${moduleKey}:${permKey}`;
      const existing = prev.overrides.find((o) => o.permission === fullKey);
      const includedByLevel = isPermissionIncludedByLevel(
        minLevel,
        currentModuleLevel,
      );

      let newOverrides: { permission: string; granted: boolean }[];
      if (existing) {
        // Remove override → revert to level-based default
        newOverrides = prev.overrides.filter((o) => o.permission !== fullKey);
      } else {
        // Create override that flips the level-based default
        newOverrides = [
          ...prev.overrides,
          { permission: fullKey, granted: !includedByLevel },
        ];
      }
      return { ...prev, overrides: newOverrides };
    });
  }

  function getEffectivePermission(
    moduleKey: string,
    permKey: string,
    minLevel: AccessLevel,
    currentModuleLevel: AccessLevel,
  ): { checked: boolean; isOverride: boolean; includedByLevel: boolean } {
    const fullKey = `${moduleKey}:${permKey}`;
    const override = (editingRole?.overrides ?? []).find(
      (o) => o.permission === fullKey,
    );
    const includedByLevel = isPermissionIncludedByLevel(
      minLevel,
      currentModuleLevel,
    );
    if (override !== undefined) {
      return {
        checked: override.granted,
        isOverride: true,
        includedByLevel,
      };
    }
    return { checked: includedByLevel, isOverride: false, includedByLevel };
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles</h1>
        <Button onClick={openCreate}>Crear rol</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de roles</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : roles.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay roles configurados
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Nombre</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Descripción
                    </th>
                    <th className="text-left py-3 px-4 font-medium">
                      Usuarios
                    </th>
                    <th className="text-left py-3 px-4 font-medium">Tipo</th>
                    <th className="text-left py-3 px-4 font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{role.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {role.description ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        {role._count?.members ?? 0}
                      </td>
                      <td className="py-3 px-4">
                        {role.isSystem && (
                          <Badge variant="secondary">Sistema</Badge>
                        )}
                        {role.isDefault && (
                          <Badge variant="outline" className="ml-1">
                            Predeterminado
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(role)}
                          >
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={role.isSystem}
                            onClick={() => setDeleteConfirmId(role.id)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delete confirmation dialog ── */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar rol</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Los usuarios asignados a este rol
              perderán sus permisos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteRole(deleteConfirmId)}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Role editor dialog ── */}
      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingRole?.id ? "Editar rol" : "Crear rol"}
            </DialogTitle>
            <DialogDescription>
              Configura los permisos de acceso para este rol.
            </DialogDescription>
          </DialogHeader>

          {editingRole && (
            <div className="space-y-6">
              {/* ── Basic fields ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role-name">Nombre</Label>
                  <Input
                    id="role-name"
                    value={editingRole.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setEditingRole((prev) =>
                        prev
                          ? {
                              ...prev,
                              name,
                              slug: prev.id ? prev.slug : toSlug(name),
                            }
                          : prev,
                      );
                    }}
                    placeholder="Ej: Contador"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-slug">Slug</Label>
                  <Input
                    id="role-slug"
                    value={editingRole.slug}
                    onChange={(e) => setField("slug", e.target.value)}
                    placeholder="contador"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-desc">Descripción</Label>
                <Textarea
                  id="role-desc"
                  value={editingRole.description ?? ""}
                  onChange={(e) =>
                    setField("description", e.target.value || null)
                  }
                  placeholder="Descripción opcional del rol"
                  rows={2}
                />
              </div>

              {/* ── Access matrix ── */}
              <div className="space-y-1">
                <Label>Matriz de acceso por módulo</Label>
                <p className="text-xs text-muted-foreground">
                  Selecciona el nivel de acceso para cada módulo.
                </p>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Módulo</TableHead>
                    {ACCESS_LEVELS.map((level) => (
                      <TableHead key={level.value} className="text-center">
                        <button
                          type="button"
                          onClick={() => setAllModulesLevel(level.value)}
                          className="hover:text-primary hover:underline cursor-pointer transition-colors"
                          title={`Seleccionar "${level.label}" para todos los módulos`}
                        >
                          {level.label}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MODULE_SECTIONS.map(({ section, modules }) => (
                    <Fragment key={section}>
                      {/* Section header */}
                      <TableRow>
                        <TableCell
                          colSpan={ACCESS_LEVELS.length + 2}
                          className="bg-muted/50 font-semibold text-xs uppercase tracking-wide"
                        >
                          {SECTION_LABELS[section] ?? section}
                        </TableCell>
                      </TableRow>
                      {/* Module rows */}
                      {modules.map((mod) => {
                        const currentLevel = getModuleAccess(
                          editingRole.moduleAccess,
                          mod.key,
                        );
                        const hasGranular =
                          mod.granularPermissions.length > 0;
                        return (
                          <Collapsible key={mod.key}>
                              <TableRow>
                                <TableCell className="font-medium">
                                  {mod.label}
                                </TableCell>
                                {ACCESS_LEVELS.map((level) => (
                                  <TableCell
                                    key={level.value}
                                    className="text-center"
                                  >
                                    <input
                                      type="radio"
                                      name={`access-${mod.key}`}
                                      value={level.value}
                                      checked={currentLevel === level.value}
                                      onChange={() =>
                                        setModuleLevel(mod.key, level.value)
                                      }
                                      className="h-4 w-4 accent-primary cursor-pointer"
                                    />
                                  </TableCell>
                                ))}
                                <TableCell className="text-center">
                                  {hasGranular && (
                                    <CollapsibleTrigger asChild>
                                      <Button variant="ghost" size="sm">
                                        Ajustes
                                      </Button>
                                    </CollapsibleTrigger>
                                  )}
                                </TableCell>
                              </TableRow>
                              {hasGranular && (
                                <CollapsibleContent asChild>
                                  <TableRow className="bg-muted/30">
                                    <TableCell
                                      colSpan={ACCESS_LEVELS.length + 2}
                                      className="py-3"
                                    >
                                      <div className="grid grid-cols-2 gap-2 pl-4">
                                        {mod.granularPermissions.map((perm) => {
                                          const effective =
                                            getEffectivePermission(
                                              mod.key,
                                              perm.key,
                                              perm.minLevel,
                                              currentLevel,
                                            );
                                          return (
                                            <label
                                              key={perm.key}
                                              className="flex items-center gap-2 text-xs cursor-pointer"
                                            >
                                              <Checkbox
                                                checked={effective.checked}
                                                onCheckedChange={() =>
                                                  toggleOverride(
                                                    mod.key,
                                                    perm.key,
                                                    perm.minLevel,
                                                    currentLevel,
                                                  )
                                                }
                                              />
                                              <span>
                                                {perm.label}
                                                {effective.includedByLevel &&
                                                  !effective.isOverride && (
                                                    <span className="text-muted-foreground ml-1">
                                                      (incluido en{" "}
                                                      {
                                                        ACCESS_LEVELS.find(
                                                          (l) =>
                                                            l.value ===
                                                            perm.minLevel,
                                                        )?.label
                                                      }
                                                      )
                                                    </span>
                                                  )}
                                              </span>
                                            </label>
                                          );
                                        })}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                </CollapsibleContent>
                              )}
                          </Collapsible>
                        );
                      })}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* ── Footer buttons ── */}
              <DialogFooter>
                <Button variant="outline" onClick={closeEditor}>
                  Cancelar
                </Button>
                <Button onClick={saveRole} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
