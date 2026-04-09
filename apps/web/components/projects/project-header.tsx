"use client";

import { Badge } from "@/components/ui/badge";
import type { Project } from "@/types/projects";

interface ProjectHeaderProps {
  project: Project;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

export function ProjectHeader({ project }: ProjectHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {project.icon && <span className="text-xl">{project.icon}</span>}
          <h1 className="text-xl font-semibold truncate">{project.name}</h1>
          <Badge variant="outline" className="text-xs">
            {project.key}
          </Badge>
          <Badge variant="secondary">{STATUS_LABELS[project.status]}</Badge>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {project.description}
          </p>
        )}
      </div>
    </div>
  );
}
