"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTaskDetail } from "@/hooks/use-task-detail";
import { useProjectStore } from "@/stores/project-store";
import { TaskStatusBadge } from "@/components/projects/task-status-badge";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import { TaskComments } from "./task-comments";
import { TaskDetailTitle } from "./task-detail-title";
import { TaskDetailDescription } from "./task-detail-description";
import { TaskActivityFeed } from "./task-activity-feed";
import { useTaskPresence } from "@/hooks/use-task-presence";
import { TaskPresenceAvatars } from "@/components/projects/task-presence-avatars";

interface TaskDetailSheetProps {
  projectKey: string;
}

export function TaskDetailSheet({ projectKey }: TaskDetailSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const { task, loading } = useTaskDetail(taskId);

  const projectId = task?.projectId ?? null;
  const storeTask = useProjectStore((s) =>
    projectId && taskId ? s.getTask(projectId, taskId) : null,
  );

  useTaskPresence(task?.projectId ?? null, taskId);

  // Merge: store fields win (they're fresh from realtime), but fall back to full-detail fields
  const displayTask = task ? { ...task, ...(storeTask ?? {}) } : null;

  function handleClose(open: boolean) {
    if (open) return;
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Sheet open={!!taskId} onOpenChange={handleClose}>
      <SheetContent side="right" className="w-full sm:max-w-[600px] overflow-y-auto">
        {loading && !displayTask ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : displayTask ? (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono">
                  {projectKey}-{displayTask.number}
                </Badge>
                {displayTask.status && <TaskStatusBadge status={displayTask.status} />}
                <TaskPriorityBadge priority={displayTask.priority} />
              </div>
              <SheetTitle className="sr-only">{displayTask.title}</SheetTitle>
              <TaskDetailTitle taskId={displayTask.id} initialTitle={displayTask.title} />
              {displayTask?.projectId && taskId && (
                <TaskPresenceAvatars projectId={displayTask.projectId} taskId={taskId} />
              )}
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <TaskDetailDescription
                taskId={displayTask.id}
                initialDescription={displayTask.description}
              />
              {displayTask.assignees && displayTask.assignees.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Asignados</h3>
                  <TaskAssigneeAvatars assignees={displayTask.assignees} max={10} size="md" />
                </div>
              )}
              {displayTask.id && (
                <div className="border-t pt-6">
                  <TaskComments taskId={displayTask.id} />
                </div>
              )}
              {displayTask.id && (
                <div className="border-t pt-6">
                  <TaskActivityFeed taskId={displayTask.id} />
                </div>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
