"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import { TENANT_HEADER } from "@zeru/shared";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface PersonProfile {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  avatarS3Key: string | null;
  notes: string | null;
  createdAt: string;
}

interface PersonsResponse {
  data: PersonProfile[];
  meta: { total: number; page: number; perPage: number; totalPages: number };
}

interface PersonForm {
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  notes: string;
}

const emptyForm: PersonForm = {
  name: "",
  role: "",
  department: "",
  email: "",
  phone: "",
  notes: "",
};

export default function DirectorioPage() {
  const [persons, setPersons] = useState<PersonProfile[]>([]);
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({});
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

  // Fetch avatar URLs for persons with avatarS3Key
  useEffect(() => {
    const personsWithAvatar = persons.filter(
      (p) => p.avatarS3Key && !avatarUrls[p.id],
    );
    if (personsWithAvatar.length === 0) return;

    personsWithAvatar.forEach(async (person) => {
      try {
        const res = await api.get<{ url: string | null }>(
          `/org-intelligence/persons/${person.id}/avatar`,
        );
        if (res.url) {
          setAvatarUrls((prev) => ({ ...prev, [person.id]: res.url! }));
        }
      } catch (err) {
        console.error("Error al cargar avatar:", err);
      }
    });
  }, [persons, avatarUrls]);

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
      department: person.department ?? "",
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
        department: form.department || undefined,
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
                    avatarUrl={avatarUrls[person.id] ?? null}
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
                      <h3 className="truncate text-sm font-semibold">
                        {person.name}
                      </h3>
                      {person.role && (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.role}
                        </p>
                      )}
                      {person.department && (
                        <p className="truncate text-xs text-muted-foreground">
                          {person.department}
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
                <Input
                  id="person-department"
                  placeholder="Ej: Operaciones"
                  value={form.department}
                  onChange={(e) =>
                    setForm({ ...form, department: e.target.value })
                  }
                />
              </div>
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
    </div>
  );
}
