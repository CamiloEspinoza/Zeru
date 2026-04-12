"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProjectPresenceAvatars } from "@/components/projects/project-presence-avatars";
import { projectsApi } from "@/lib/api/projects";
import type { Project } from "@/types/projects";

interface ProjectHeaderProps {
  project: Project;
  onUpdated?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

export function ProjectHeader({ project, onUpdated }: ProjectHeaderProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [visibility, setVisibility] = useState(project.visibility);
  const [color, setColor] = useState(project.color ?? "#6B7280");
  const [saving, setSaving] = useState(false);

  function openEdit() {
    setName(project.name);
    setDescription(project.description ?? "");
    setVisibility(project.visibility);
    setColor(project.color ?? "#6B7280");
    setEditOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await projectsApi.update(project.id, {
        name: name.trim(),
        description: description.trim() || null,
        visibility,
        color,
      });
      toast.success("Proyecto actualizado");
      setEditOpen(false);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar proyecto");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {project.icon && <span className="text-xl">{project.icon}</span>}
            <button
              onClick={openEdit}
              className="text-xl font-semibold truncate hover:underline underline-offset-2 text-left"
              title="Editar proyecto"
            >
              {project.name}
            </button>
            <Badge variant="outline" className="text-xs">
              {project.key}
            </Badge>
            <Badge variant="secondary">{STATUS_LABELS[project.status]}</Badge>
            <Badge variant="outline" className="text-xs">
              {project.visibility === "PRIVATE" ? "Privado" : "Público"}
            </Badge>
          </div>
          {project.description && (
            <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <ProjectPresenceAvatars projectId={project.id} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar proyecto</DialogTitle>
            <DialogDescription>Modifica los datos generales del proyecto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded border-0 p-0"
              />
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre del proyecto"
                className="flex-1"
              />
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripcion del proyecto..."
              rows={3}
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Visibilidad:</span>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as "PUBLIC" | "PRIVATE")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Publico</SelectItem>
                  <SelectItem value="PRIVATE">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
