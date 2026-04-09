"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTaskDetail } from "@/hooks/use-task-detail";
import { TaskStatusBadge } from "@/components/projects/task-status-badge";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import { TaskComments } from "./task-comments";

interface TaskDetailSheetProps {
  projectKey: string;
}

export function TaskDetailSheet({ projectKey }: TaskDetailSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const { task, loading } = useTaskDetail(taskId);

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
        {loading && !task ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : task ? (
          <>
            <SheetHeader className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="font-mono">
                  {projectKey}-{task.number}
                </Badge>
                {task.status && <TaskStatusBadge status={task.status} />}
                <TaskPriorityBadge priority={task.priority} />
              </div>
              <SheetTitle className="text-xl">{task.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {task.description && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Descripción</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              )}
              {task.assignees && task.assignees.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">Asignados</h3>
                  <TaskAssigneeAvatars assignees={task.assignees} max={10} size="md" />
                </div>
              )}
              {task.id && (
                <div className="border-t pt-6">
                  <TaskComments taskId={task.id} />
                </div>
              )}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
