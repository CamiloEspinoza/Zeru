"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import { TENANT_HEADER } from "@zeru/shared";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonAvatar } from "@/components/org-intelligence/person-avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EducationalEmptyState } from "@/components/org-intelligence/educational-empty-state";
import { DepartmentSelector } from "@/components/org-intelligence/department-selector";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MoreHorizontalCircle01Icon,
  Edit02Icon,
  Delete02Icon,
  Image02Icon,
} from "@hugeicons/core-free-icons";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";

interface DepartmentRef {
  id: string;
  name: string;
  color: string | null;
}

interface PersonProfile {
  id: string;
  name: string;
  role: string | null;
  departmentId: string | null;
  department: DepartmentRef | null;
  personType: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  avatarS3Key: string | null;
  notes: string | null;
  createdAt: string;
  user?: {
    id: string;
    email: string;
    isActive: boolean;
    type: string;
  } | null;
}

interface PersonsResponse {
  data: PersonProfile[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

interface PersonForm {
  name: string;
  role: string;
  departmentId: string | null;
  departmentName: string;
  personType: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: PersonForm = {
  name: "",
  role: "",
  departmentId: null,
  departmentName: "",
  personType: "INTERNAL",
  company: "",
  email: "",
  phone: "",
  notes: "",
};

export default function DirectorioPage() {
  const [persons, setPersons] = useState<PersonProfile[]>([]);
  // avatarUrls state removed — avatarUrl now comes from API response directly
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<PersonProfile | null>(null);
  const [form, setForm] = useState<PersonForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingPerson, setDeletingPerson] = useState<PersonProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Create user from person
  const [createUserPerson, setCreateUserPerson] = useState<PersonProfile | null>(null);
  const [createUserRole, setCreateUserRole] = useState<string>("VIEWER");
  const [creatingUser, setCreatingUser] = useState(false);

  // Avatar upload
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const avatarTargetIdRef = useRef<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPersons = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await api.get<PersonsResponse>(
        `/org-intelligence/persons?${params.toString()}`,
      );
      setPersons(res.data);
    } catch (err) {
      console.error("Error al cargar personas:", err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    fetchPersons();
  }, [fetchPersons]);

  // avatarUrl now comes directly from the API response (no separate fetch needed)

  const openCreateDialog = () => {
    setEditingPerson(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (person: PersonProfile) => {
    setEditingPerson(person);
    setForm({
      name: person.name,
      role: person.role ?? "",
      departmentId: person.departmentId ?? null,
      departmentName: person.department?.name ?? "",
      personType: person.personType ?? "INTERNAL",
      company: person.company ?? "",
      email: person.email ?? "",
      phone: person.phone ?? "",
      notes: person.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        role: form.role || undefined,
        departmentId: form.departmentId || null,
        personType: form.personType || "INTERNAL",
        company: form.personType !== "INTERNAL" ? (form.company || undefined) : undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        notes: form.notes || undefined,
      };

      if (editingPerson) {
        await api.patch(
          `/org-intelligence/persons/${editingPerson.id}`,
          payload,
        );
      } else {
        await api.post("/org-intelligence/persons", payload);
      }

      setDialogOpen(false);
      setForm(emptyForm);
      setEditingPerson(null);
      await fetchPersons();
    } catch (err) {
      console.error("Error al guardar persona:", err);
      toast.error("No se pudo guardar la persona. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (person: PersonProfile) => {
    setDeletingPerson(person);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingPerson) return;
    setDeleting(true);
    try {
      await api.delete(`/org-intelligence/persons/${deletingPerson.id}`);
      setDeleteDialogOpen(false);
      setDeletingPerson(null);
      await fetchPersons();
    } catch (err) {
      console.error("Error al eliminar persona:", err);
      toast.error("No se pudo eliminar la persona.");
    } finally {
      setDeleting(false);
    }
  };

  const triggerAvatarUpload = (personId: string) => {
    avatarTargetIdRef.current = personId;
    avatarInputRef.current?.click();
  };

  function openCreateUserDialog(person: PersonProfile) {
    setCreateUserPerson(person);
    setCreateUserRole("VIEWER");
  }

  async function handleCreateUser() {
    if (!createUserPerson) return;
    setCreatingUser(true);
    try {
      await api.post(
        `/org-intelligence/persons/${createUserPerson.id}/create-user`,
        { role: createUserRole },
      );
      toast.success(`Cuenta creada para ${createUserPerson.name}`);
      setCreateUserPerson(null);
      fetchPersons();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear cuenta";
      toast.error(msg);
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleUnlinkUser(person: PersonProfile) {
    if (!confirm(`¿Desvincular el usuario de ${person.name}?`)) return;
    try {
      await api.patch(
        `/org-intelligence/persons/${person.id}`,
        { userId: null },
      );
      toast.success("Usuario desvinculado");
      fetchPersons();
    } catch {
      toast.error("Error al desvincular");
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const personId = avatarTargetIdRef.current;
    if (!file || !personId) return;

    setUploadingAvatarId(personId);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const tenantId =
        typeof window !== "undefined"
          ? localStorage.getItem("tenantId")
          : null;
      const token =
        typeof window !== "undefined"
          ? localStorage.getItem("access_token")
          : null;

      const headers: Record<string, string> = {};
      if (tenantId) headers[TENANT_HEADER] = tenantId;
      if (token) headers["Authorization"] = `Bearer ${token}`;

      await fetch(
        `${API_BASE}/org-intelligence/persons/${personId}/avatar`,
        {
          method: "POST",
          headers,
          body: formData,
        },
      );

      // Re-fetch avatar URL
      const res = await api.get<{ url: string | null }>(
        `/org-intelligence/persons/${personId}/avatar`,
      );
      if (res.url) {
        setAvatarUrls((prev) => ({ ...prev, [personId]: res.url! }));
      }
      await fetchPersons();
    } catch (err) {
      console.error("Error al subir avatar:", err);
      toast.error("No se pudo subir la foto de perfil.");
    } finally {
      setUploadingAvatarId(null);
      avatarTargetIdRef.current = null;
      // Reset file input
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Directorio de Personas</h1>
          <p className="text-muted-foreground mt-1">
            Directorio de personas de la organización. Estos perfiles se
            vinculan como participantes de entrevistas y aparecen en
            transcripciones y diagramas.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Nueva Persona</Button>
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por nombre, cargo, departamento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : persons.length === 0 ? (
        debouncedSearch ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No se encontraron personas con esa búsqueda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <EducationalEmptyState
            icon={
              <svg className="size-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 00-3-3.87" />
                <path d="M16 3.13a4 4 0 010 7.75" />
              </svg>
            }
            title="Registra a las personas de tu organización"
            description="El directorio de personas te permite crear perfiles con nombre, cargo, área y foto. Estas personas podrán ser asignadas como participantes de las entrevistas, lo que mejora la identificación de hablantes y las visualizaciones."
            action={{ label: "Agregar primera persona", onClick: openCreateDialog }}
            tip="Tip: Registra primero a los coordinadores que vas a entrevistar. Puedes agregar más personas después."
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {persons.map((person) => (
            <Card key={person.id} className="group relative">
              <CardContent className="flex items-start gap-4 p-4">
                <div className="relative">
                  <PersonAvatar
                    name={person.name}
                    avatarUrl={(person as Record<string, unknown>).avatarUrl as string ?? null}
                    size="lg"
                  />
                  {uploadingAvatarId === person.id && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold">
                          {person.name}
                        </h3>
                        {person.personType === "EXTERNAL" && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
                            Externo
                          </Badge>
                        )}
                        {person.personType === "CONTRACTOR" && (
                          <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
                            Contratista
                          </Badge>
                        )}
                        {person.user && (
                          <Badge variant={person.user.isActive ? "default" : "destructive"} className="text-[10px]">
                            {person.user.isActive ? "Usuario activo" : "Usuario inactivo"}
                          </Badge>
                        )}
                      </div>
                      {person.role && (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.role}
                        </p>
                      )}
                      {person.department?.name && (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.department.name}
                        </p>
                      )}
                      {person.company && person.personType !== "INTERNAL" && (
                        <p className="truncate text-xs text-muted-foreground italic">
                          {person.company}
                        </p>
                      )}
                      {person.email && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {person.email}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <HugeiconsIcon
                            icon={MoreHorizontalCircle01Icon}
                            className="size-4"
                          />
                          <span className="sr-only">Acciones</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openEditDialog(person)}
                        >
                          <HugeiconsIcon
                            icon={Edit02Icon}
                            className="mr-2 size-4"
                          />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => triggerAvatarUpload(person.id)}
                        >
                          <HugeiconsIcon
                            icon={Image02Icon}
                            className="mr-2 size-4"
                          />
                          {person.avatarS3Key ? "Cambiar foto" : "Subir foto"}
                        </DropdownMenuItem>
                        {!person.user && (
                          <DropdownMenuItem
                            onClick={() => openCreateUserDialog(person)}
                            disabled={!person.email}
                          >
                            {person.email ? "Crear cuenta de usuario" : "Sin email — no se puede crear cuenta"}
                          </DropdownMenuItem>
                        )}
                        {person.user && (
                          <DropdownMenuItem onClick={() => handleUnlinkUser(person)}>
                            Desvincular usuario
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => openDeleteDialog(person)}
                        >
                          <HugeiconsIcon
                            icon={Delete02Icon}
                            className="mr-2 size-4"
                          />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Hidden file input for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,image/*"
        className="hidden"
        onChange={handleAvatarChange}
      />

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPerson ? "Editar Persona" : "Nueva Persona"}
            </DialogTitle>
            <DialogDescription>
              {editingPerson
                ? "Modifica los datos del perfil de esta persona."
                : "Crea un nuevo perfil de persona para vincular a entrevistas."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="person-name">Nombre *</Label>
              <Input
                id="person-name"
                placeholder="Nombre completo"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="person-role">Cargo</Label>
                <Input
                  id="person-role"
                  placeholder="Ej: Gerente de Operaciones"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="person-department">Departamento</Label>
                <DepartmentSelector
                  value={form.departmentId}
                  onChange={(id, name) =>
                    setForm({
                      ...form,
                      departmentId: id,
                      departmentName: name ?? "",
                    })
                  }
                />
              </div>
            </div>
            <div className={`grid gap-4 ${form.personType !== "INTERNAL" ? "grid-cols-2" : "grid-cols-1"}`}>
              <div className="space-y-1.5">
                <Label htmlFor="person-type">Tipo de persona</Label>
                <Select
                  value={form.personType}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      personType: value,
                      company: value === "INTERNAL" ? "" : form.company,
                    })
                  }
                >
                  <SelectTrigger id="person-type">
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTERNAL">Interno</SelectItem>
                    <SelectItem value="EXTERNAL">Externo</SelectItem>
                    <SelectItem value="CONTRACTOR">Contratista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.personType !== "INTERNAL" && (
                <div className="space-y-1.5">
                  <Label htmlFor="person-company">Empresa</Label>
                  <Input
                    id="person-company"
                    placeholder="Nombre de la empresa"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="person-email">Email</Label>
                <Input
                  id="person-email"
                  type="email"
                  placeholder="correo@empresa.cl"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="person-phone">Teléfono</Label>
                <Input
                  id="person-phone"
                  placeholder="+56 9 1234 5678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="person-notes">Notas</Label>
              <Textarea
                id="person-notes"
                placeholder="Notas adicionales sobre esta persona"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setForm(emptyForm);
                setEditingPerson(null);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
            >
              {saving
                ? "Guardando..."
                : editingPerson
                  ? "Guardar"
                  : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar persona</DialogTitle>
            <DialogDescription>
              Se eliminará el perfil de &ldquo;{deletingPerson?.name}&rdquo;. Esta
              acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog open={!!createUserPerson} onOpenChange={(open) => !open && setCreateUserPerson(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear cuenta de usuario</DialogTitle>
            <DialogDescription>
              Se creará una cuenta y se enviará una invitación por email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Nombre</Label>
              <p className="text-sm font-medium">{createUserPerson?.name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <p className="text-sm font-medium">{createUserPerson?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Rol en la organización</Label>
              <Select value={createUserRole} onValueChange={setCreateUserRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Propietario</SelectItem>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="ACCOUNTANT">Contador</SelectItem>
                  <SelectItem value="VIEWER">Solo lectura</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateUserPerson(null)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser ? "Creando..." : "Crear cuenta y enviar invitación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
