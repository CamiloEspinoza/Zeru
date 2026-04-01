"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

const PROJECT_STATUSES = [
  { value: "DRAFT", label: "Borrador" },
  { value: "ACTIVE", label: "Activo" },
  { value: "COMPLETED", label: "Completado" },
  { value: "ARCHIVED", label: "Archivado" },
];

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
}

interface ProjectHeaderProps {
  project: Project;
  onChangeStatus: (status: string) => void;
  onEdit?: () => void;
  onDelete: () => void;
  changingStatus?: boolean;
}

export function ProjectHeader({
  project,
  onChangeStatus,
  onDelete,
  changingStatus = false,
}: ProjectHeaderProps) {
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <StatusBadge type="project" value={project.status} />
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
        <div className="flex gap-3 text-xs text-muted-foreground">
          {project.startDate && (
            <span>Inicio: {formatDate(project.startDate)}</span>
          )}
          {project.endDate && <span>Fin: {formatDate(project.endDate)}</span>}
          <span>Creado: {formatDate(project.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={project.status}
          onValueChange={onChangeStatus}
          disabled={changingStatus}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            {PROJECT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          <span className="sr-only">Eliminar proyecto</span>
        </Button>
      </div>
    </div>
  );
}
