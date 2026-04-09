"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { TaskDone01Icon, UserMultiple02Icon } from "@hugeicons/core-free-icons";
import type { Project } from "@/types/projects";

interface ProjectCardProps {
  project: Project;
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  COMPLETED: "Completado",
  ARCHIVED: "Archivado",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  COMPLETED: "outline",
  ARCHIVED: "outline",
};

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base">
              {project.icon && <span className="mr-2">{project.icon}</span>}
              {project.name}
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{project.key}</p>
          </div>
          <Badge variant={STATUS_VARIANTS[project.status]}>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {project.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={TaskDone01Icon} className="size-3.5" />
          <span>{project._count?.tasks ?? 0} tareas</span>
        </div>
        <div className="flex items-center gap-1">
          <HugeiconsIcon icon={UserMultiple02Icon} className="size-3.5" />
          <span>{project._count?.members ?? 0} miembros</span>
        </div>
      </CardFooter>
    </Card>
  );
}
