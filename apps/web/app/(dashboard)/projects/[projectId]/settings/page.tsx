"use client";

import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useProject } from "@/hooks/use-project";
import { projectsApi } from "@/lib/api/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import type { TaskStatusConfig, ProjectMember, Label } from "@/types/projects";
import { PropertyDefinitionList } from "@/components/projects/properties/property-definition-list";

/* ─── Helpers ──────────────────────────────────────────────── */

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ─── Status Row ───────────────────────────────────────────── */

function StatusRow({
  status,
  projectId,
  onRefresh,
}: {
  status: TaskStatusConfig;
  projectId: string;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color ?? "#6B7280");
  const [category, setCategory] = useState(status.category);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name === status.name && color === (status.color ?? "#6B7280") && category === status.category) return;
    setSaving(true);
    try {
      await projectsApi.updateStatus(projectId, status.id, { name, color, category });
      toast.success("Estado actualizado");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar estado");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminar estado "${status.name}"?`)) return;
    try {
      await projectsApi.deleteStatus(projectId, status.id);
      toast.success("Estado eliminado");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar estado");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={handleSave}
        className="size-7 shrink-0 cursor-pointer rounded border-0 p-0"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        className="h-8 flex-1 text-sm"
        disabled={saving}
      />
      <Select value={category} onValueChange={async (v) => {
        const newCat = v as TaskStatusConfig["category"];
        setCategory(newCat);
        setSaving(true);
        try {
          await projectsApi.updateStatus(projectId, status.id, { name, color, category: newCat });
          toast.success("Estado actualizado");
          onRefresh();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al actualizar estado");
        } finally {
          setSaving(false);
        }
      }}>
        <SelectTrigger className="h-8 w-28 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="backlog">Backlog</SelectItem>
          <SelectItem value="active">Activo</SelectItem>
          <SelectItem value="done">Hecho</SelectItem>
          <SelectItem value="cancelled">Cancelado</SelectItem>
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-destructive hover:text-destructive"
        onClick={handleDelete}
        disabled={status.isDefault}
        title={status.isDefault ? "No se puede eliminar el estado predeterminado" : "Eliminar estado"}
      >
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </Button>
    </div>
  );
}

/* ─── Add Status Dialog ────────────────────────────────────── */

function AddStatusDialog({
  projectId,
  onRefresh,
}: {
  projectId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [category, setCategory] = useState("active");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await projectsApi.createStatus(projectId, {
        name: name.trim(),
        slug: slugify(name.trim()),
        color,
        category,
      });
      toast.success("Estado creado");
      setName("");
      setColor("#6B7280");
      setCategory("active");
      setOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear estado");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
          Agregar estado
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nuevo estado</DialogTitle>
          <DialogDescription>Crea un nuevo estado para las columnas del board.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-8 cursor-pointer rounded border-0 p-0"
            />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del estado"
              className="flex-1"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="active">Activo</SelectItem>
              <SelectItem value="done">Hecho</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creando..." : "Crear estado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Member Row ───────────────────────────────────────────── */

function MemberRow({
  member,
  projectId,
  onRefresh,
}: {
  member: ProjectMember;
  projectId: string;
  onRefresh: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleRoleChange(role: string) {
    setSaving(true);
    try {
      await projectsApi.updateMember(projectId, member.userId, role as "ADMIN" | "MEMBER" | "VIEWER");
      toast.success("Rol actualizado");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar rol");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm(`Eliminar a ${member.user.firstName} ${member.user.lastName} del proyecto?`)) return;
    try {
      await projectsApi.removeMember(projectId, member.userId);
      toast.success("Miembro eliminado");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar miembro");
    }
  }

  const isOwner = member.role === "OWNER";

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <UserAvatar
          userId={member.userId}
          name={`${member.user.firstName} ${member.user.lastName}`}
          className="size-8"
        />
        <div>
          <p className="text-sm font-medium">
            {member.user.firstName} {member.user.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {member.user.email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {isOwner ? (
          <Badge variant="outline">OWNER</Badge>
        ) : (
          <>
            <Select value={member.role} onValueChange={handleRoleChange} disabled={saving}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Miembro</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-destructive hover:text-destructive"
              onClick={handleRemove}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Invite Member Dialog ──────────────────────────────────── */

function InviteMemberDialog({
  projectId,
  existingMemberIds,
  onRefresh,
}: {
  projectId: string;
  existingMemberIds: Set<string>;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MEMBER" | "VIEWER">("MEMBER");
  const [users, setUsers] = useState<Array<{ id: string; firstName: string; lastName: string; email: string; avatarUrl?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setUsers([]);
      return;
    }
    setLoading(true);
    try {
      const { api } = await import("@/lib/api-client");
      const res = await api.get<{ data: Array<{ id: string; firstName: string; lastName: string; email: string; avatarUrl?: string }> }>(
        `/users?search=${encodeURIComponent(query)}&perPage=10`,
      );
      setUsers(res.data.filter((u) => !existingMemberIds.has(u.id)));
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [existingMemberIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search.trim().length >= 2) searchUsers(search.trim());
      else setUsers([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchUsers]);

  async function handleInvite(userId: string) {
    setSaving(true);
    try {
      await projectsApi.addMember(projectId, userId, role);
      toast.success("Miembro agregado");
      setOpen(false);
      setSearch("");
      setUsers([]);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al agregar miembro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
          Invitar miembro
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invitar miembro</DialogTitle>
          <DialogDescription>Busca usuarios de tu organizacion para agregarlos al proyecto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o email..."
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Rol:</span>
            <Select value={role} onValueChange={(v) => setRole(v as "ADMIN" | "MEMBER" | "VIEWER")}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Admin</SelectItem>
                <SelectItem value="MEMBER">Miembro</SelectItem>
                <SelectItem value="VIEWER">Viewer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {loading && <p className="text-xs text-muted-foreground text-center py-3">Buscando...</p>}
            {!loading && search.length >= 2 && users.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">No se encontraron usuarios</p>
            )}
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleInvite(u.id)}
                disabled={saving}
                className="flex w-full items-center gap-3 rounded-md p-2 text-sm hover:bg-accent transition-colors"
              >
                <UserAvatar
                  userId={u.id}
                  name={`${u.firstName} ${u.lastName}`}
                  className="size-7"
                />
                <div className="text-left min-w-0 flex-1">
                  <p className="font-medium truncate">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Label Row ────────────────────────────────────────────── */

function LabelRow({
  label,
  projectId,
  onRefresh,
}: {
  label: Label;
  projectId: string;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState(label.color);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (name === label.name && color === label.color) return;
    setSaving(true);
    try {
      await projectsApi.updateLabel(projectId, label.id, { name, color });
      toast.success("Etiqueta actualizada");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar etiqueta");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Eliminar etiqueta "${label.name}"?`)) return;
    try {
      await projectsApi.deleteLabel(projectId, label.id);
      toast.success("Etiqueta eliminada");
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar etiqueta");
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md border p-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="size-7 shrink-0 cursor-pointer rounded border-0 p-0"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={handleSave}
        className="h-8 flex-1 text-sm"
        disabled={saving}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0 text-destructive hover:text-destructive"
        onClick={handleDelete}
      >
        <HugeiconsIcon icon={Delete02Icon} className="size-4" />
      </Button>
    </div>
  );
}

/* ─── Add Label Dialog ─────────────────────────────────────── */

function AddLabelDialog({
  projectId,
  onRefresh,
}: {
  projectId: string;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await projectsApi.createLabel(projectId, name.trim(), color);
      toast.success("Etiqueta creada");
      setName("");
      setColor("#3B82F6");
      setOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear etiqueta");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={PlusSignIcon} className="mr-1 size-4" />
          Agregar etiqueta
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nueva etiqueta</DialogTitle>
          <DialogDescription>Crea una etiqueta para clasificar tareas.</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="size-8 cursor-pointer rounded border-0 p-0"
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la etiqueta"
            className="flex-1"
          />
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={saving || !name.trim()}>
            {saving ? "Creando..." : "Crear etiqueta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Main Settings Page ───────────────────────────────────── */

export default function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const router = useRouter();
  const { project, loading, refetch } = useProject(projectId);

  async function handleDelete() {
    if (
      !confirm(
        "Estas seguro de eliminar este proyecto? Esta accion no se puede deshacer.",
      )
    )
      return;
    try {
      await projectsApi.remove(projectId);
      toast.success("Proyecto eliminado");
      router.push("/projects");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar proyecto",
      );
    }
  }

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const sortedStatuses = (project.taskStatuses ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const sortedLabels = (project.labels ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const existingMemberIds = new Set((project.members ?? []).map((m) => m.userId));

  return (
    <div className="max-w-3xl space-y-6">
      {/* Members */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Miembros</CardTitle>
            <CardDescription>
              Personas con acceso a este proyecto
            </CardDescription>
          </div>
          <InviteMemberDialog
            projectId={projectId}
            existingMemberIds={existingMemberIds}
            onRefresh={refetch}
          />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(project.members ?? []).map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                projectId={projectId}
                onRefresh={refetch}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Statuses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Estados personalizados</CardTitle>
            <CardDescription>
              Los estados se muestran como columnas en el board
            </CardDescription>
          </div>
          <AddStatusDialog projectId={projectId} onRefresh={refetch} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedStatuses.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                projectId={projectId}
                onRefresh={refetch}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Labels */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Etiquetas</CardTitle>
            <CardDescription>
              Etiquetas para clasificar tareas
            </CardDescription>
          </div>
          <AddLabelDialog projectId={projectId} onRefresh={refetch} />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedLabels.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay etiquetas configuradas.</p>
            ) : (
              sortedLabels.map((label) => (
                <LabelRow
                  key={label.id}
                  label={label}
                  projectId={projectId}
                  onRefresh={refetch}
                />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Propiedades personalizadas</CardTitle>
          <CardDescription>
            Campos adicionales tipo Notion para las tareas de este tablero
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PropertyDefinitionList projectId={projectId} />
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Zona de peligro</CardTitle>
          <CardDescription>
            Eliminar el proyecto archivara todas sus tareas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete}>
            <HugeiconsIcon icon={Delete02Icon} className="mr-2 size-4" />
            Eliminar proyecto
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
