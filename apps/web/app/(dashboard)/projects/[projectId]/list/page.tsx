"use client";

import { use } from "react";
import { useProject } from "@/hooks/use-project";
import { useProjectTasks } from "@/hooks/use-project-tasks";
import { TaskListView } from "@/components/projects/list/task-list-view";
import { CreateTaskDialog } from "@/components/projects/create-task-dialog";
import { Skeleton } from "@/components/ui/skeleton";

export default function ListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const { project } = useProject(projectId);
  const { tasks, loading, refetch } = useProjectTasks(projectId);

  if (!project || loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const statuses = (project.taskStatuses ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateTaskDialog
          projectId={projectId}
          statuses={statuses}
          onCreated={refetch}
        />
      </div>
      <TaskListView tasks={tasks} projectKey={project.key} statuses={statuses} />
    </div>
  );
}
