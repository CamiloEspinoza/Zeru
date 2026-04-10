"use client";

import { use } from "react";
import { useProjectContext } from "../project-context";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { KanbanBoard } from "@/components/projects/board/kanban-board";
import { Skeleton } from "@/components/ui/skeleton";

export default function BoardPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProjectContext();
  const { tasks, loading, refetch } = useProjectTasks(projectId);

  if (loading) {
    return (
      <div className="flex gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  const statuses = (project.taskStatuses ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <KanbanBoard
      projectId={projectId}
      projectKey={project.key}
      statuses={statuses}
      tasks={tasks}
      onRefetch={refetch}
    />
  );
}
