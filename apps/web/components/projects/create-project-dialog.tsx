"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { projectsApi } from "@/lib/api/projects";

interface CreateProjectDialogProps {
  onCreated: () => void;
}

export function CreateProjectDialog({ onCreated }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");

  function reset() {
    setName("");
    setKey("");
    setDescription("");
    setVisibility("PUBLIC");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;
    setLoading(true);
    try {
      await projectsApi.create({
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || undefined,
        visibility,
      });
      toast.success("Proyecto creado");
      setOpen(false);
      reset();
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al crear proyecto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">Nuevo proyecto</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Crear proyecto</DialogTitle>
            <DialogDescription>
              Crea un espacio de trabajo para organizar tareas y colaborar con tu equipo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lanzamiento Q2"
                required
                minLength={1}
                maxLength={200}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="key">Clave del proyecto</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="Q2LAUNCH"
                required
                minLength={1}
                maxLength={10}
                pattern="[A-Z0-9]+"
              />
              <p className="text-xs text-muted-foreground">
                Solo mayúsculas y números. Las tareas se numerarán como {key || "KEY"}-1, {key || "KEY"}-2, etc.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Opcional"
                rows={3}
                maxLength={5000}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="visibility">Visibilidad</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as "PUBLIC" | "PRIVATE")}>
                <SelectTrigger id="visibility">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público (todos los miembros)</SelectItem>
                  <SelectItem value="PRIVATE">Privado (solo invitados)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !name.trim() || !key.trim()}>
              {loading ? "Creando..." : "Crear proyecto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
