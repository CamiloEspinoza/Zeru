"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { ProjectHeader } from "@/components/projects/project-header";
import { ViewSwitcher } from "@/components/projects/view-switcher";
import { TaskDetailSheet } from "@/components/projects/detail/task-detail-sheet";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project, loading, error } = useProject(projectId);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-10 w-full max-w-md" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <p className="text-sm text-destructive">
          {error ?? "Proyecto no encontrado"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <ProjectHeader project={project} />
      <ViewSwitcher projectId={projectId} />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      <TaskDetailSheet projectKey={project.key} />
    </div>
  );
}
