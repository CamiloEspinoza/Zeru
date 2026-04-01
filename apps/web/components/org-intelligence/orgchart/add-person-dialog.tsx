"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Department {
  id: string;
  name: string;
  color: string;
}

interface AddPersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportsToId: string | null;
  reportsToName?: string;
  onCreated: () => void;
}

const EMPTY_FORM = { name: "", role: "", departmentId: "" };

export function AddPersonDialog({
  open,
  onOpenChange,
  reportsToId,
  reportsToName,
  onCreated,
}: AddPersonDialogProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingDepts, setLoadingDepts] = useState(false);

  const fetchDepartments = useCallback(async () => {
    setLoadingDepts(true);
    try {
      const data = await api.get<Department[]>("/org-intelligence/departments");
      setDepartments(data);
    } catch {
      // Non-critical: continue without departments
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setForm(EMPTY_FORM);
      void fetchDepartments();
    }
  }, [open, fetchDepartments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    setLoading(true);
    try {
      const payload: Record<string, string> = { name: form.name.trim() };
      if (form.role.trim()) payload.role = form.role.trim();
      if (form.departmentId) payload.departmentId = form.departmentId;

      const created = await api.post<{ id: string }>("/org-intelligence/persons", payload);

      if (reportsToId) {
        await api.patch(`/org-intelligence/persons/${created.id}/reports-to`, {
          reportsToId,
        });
      }

      toast.success("Persona creada correctamente");
      onCreated();
      onOpenChange(false);
    } catch {
      toast.error("Error al crear la persona");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Agregar persona</DialogTitle>
          <DialogDescription>
            {reportsToName
              ? `Nuevo reporte directo de ${reportsToName}`
              : "Agregar una nueva persona al organigrama"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {/* Nombre */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="add-person-name">
              Nombre <span className="text-destructive">*</span>
            </label>
            <Input
              id="add-person-name"
              placeholder="Nombre completo"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
          </div>

          {/* Cargo */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="add-person-role">
              Cargo
            </label>
            <Input
              id="add-person-role"
              placeholder="Ej. Gerente de Ventas"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            />
          </div>

          {/* Departamento */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Departamento</label>
            <Select
              value={form.departmentId}
              onValueChange={(val) =>
                setForm((f) => ({ ...f, departmentId: val }))
              }
              disabled={loadingDepts}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingDepts ? "Cargando..." : "Seleccionar departamento"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading ? "Creando..." : "Crear persona"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
