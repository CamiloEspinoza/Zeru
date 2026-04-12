"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useTaskDetail } from "@/hooks/use-task-detail";
import { useProject } from "@/hooks/use-project";
import { useProjectStore } from "@/stores/project-store";
import { TaskPresenceAvatars } from "@/components/projects/task-presence-avatars";
import { TaskComments } from "./task-comments";
import { TaskDetailTitle } from "./task-detail-title";
import { TaskDetailDescription } from "./task-detail-description";
import { TaskActivityFeed } from "./task-activity-feed";
import { TaskPropertyRow } from "./task-property-row";
import { TaskStatusSelect } from "./task-status-select";
import { TaskPrioritySelect } from "./task-priority-select";
import { TaskAssigneeSelect } from "./task-assignee-select";
import { TaskDueDatePicker } from "./task-due-date-picker";
import { TaskLabelSelect } from "./task-label-select";
import { TaskCustomProperties } from "@/components/projects/properties/task-custom-properties";
import { useTaskPresence } from "@/hooks/use-task-presence";
import { useMemo, useCallback, useState, useRef, useEffect } from "react";

interface TaskDetailSheetProps {
  projectKey: string;
}

export function TaskDetailSheet({ projectKey }: TaskDetailSheetProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get("task");
  const { task, loading, refetch } = useTaskDetail(taskId);

  const projectId = task?.projectId ?? null;
  const { project } = useProject(projectId);

  const storeStatus = useProjectStore((s) =>
    projectId && taskId ? s.getTask(projectId, taskId)?.status : undefined,
  );
  const storePriority = useProjectStore((s) =>
    projectId && taskId ? s.getTask(projectId, taskId)?.priority : undefined,
  );

  useTaskPresence(projectId, taskId);

  const displayTask = useMemo(() => {
    if (!task) return null;
    return {
      ...task,
      ...(storeStatus !== undefined ? { status: storeStatus } : {}),
      ...(storePriority !== undefined ? { priority: storePriority } : {}),
    };
  }, [task, storeStatus, storePriority]);

  const statuses = useMemo(
    () => (project?.taskStatuses ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [project?.taskStatuses],
  );

  const handleRefetch = useCallback(() => {
    refetch();
  }, [refetch]);

  // ─── Resizable drawer ────────────────────────────────
  const MIN_WIDTH = 480;
  const MAX_WIDTH = typeof window !== "undefined" ? Math.min(1200, window.innerWidth * 0.85) : 1200;
  const [drawerWidth, setDrawerWidth] = useState(640);
  const isResizing = useRef(false);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isResizing.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, window.innerWidth - e.clientX));
      setDrawerWidth(newWidth);
    }
    function onMouseUp() {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [MAX_WIDTH]);

  function startResize(e: React.MouseEvent) {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleClose(open: boolean) {
    if (open) return;
    const params = new URLSearchParams(searchParams);
    params.delete("task");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Sheet open={!!taskId} onOpenChange={handleClose}>
      <SheetContent side="right" className="overflow-y-auto p-0" style={{ width: drawerWidth, maxWidth: '85vw' }} aria-describedby={undefined}>
        {/* Resize handle */}
        <div
          onMouseDown={startResize}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-50"
        />
        <SheetTitle className="sr-only">Detalle de tarea</SheetTitle>
        {loading && !displayTask ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : displayTask ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 border-b space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="font-mono text-xs">
                  {projectKey}-{displayTask.number}
                </Badge>
                {displayTask?.projectId && taskId && (
                  <TaskPresenceAvatars projectId={displayTask.projectId} taskId={taskId} />
                )}
              </div>
              <TaskDetailTitle taskId={displayTask.id} initialTitle={displayTask.title} />
            </SheetHeader>

            {/* Properties Panel */}
            <div className="px-6 py-4 border-b bg-muted/30">
              <TaskPropertyRow label="Estado">
                <TaskStatusSelect
                  taskId={displayTask.id}
                  currentStatusId={displayTask.statusId}
                  statuses={statuses}
                  onUpdated={handleRefetch}
                />
              </TaskPropertyRow>
              <TaskPropertyRow label="Prioridad">
                <TaskPrioritySelect
                  taskId={displayTask.id}
                  currentPriority={displayTask.priority}
                  onUpdated={handleRefetch}
                />
              </TaskPropertyRow>
              <TaskPropertyRow label="Asignados">
                <TaskAssigneeSelect
                  taskId={displayTask.id}
                  projectId={displayTask.projectId}
                  assignees={displayTask.assignees ?? []}
                  onUpdated={handleRefetch}
                />
              </TaskPropertyRow>
              <TaskPropertyRow label="Fecha limite">
                <TaskDueDatePicker
                  taskId={displayTask.id}
                  currentDueDate={displayTask.dueDate}
                  onUpdated={handleRefetch}
                />
              </TaskPropertyRow>
              <TaskPropertyRow label="Etiquetas">
                <TaskLabelSelect
                  taskId={displayTask.id}
                  projectId={displayTask.projectId}
                  currentLabels={displayTask.labels ?? []}
                  onUpdated={handleRefetch}
                />
              </TaskPropertyRow>

              {/* Custom Properties */}
              {displayTask.projectId && (
                <div className="mt-2 border-t border-border/50 pt-2">
                  <TaskCustomProperties
                    taskId={displayTask.id}
                    projectId={displayTask.projectId}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 px-6 py-6 space-y-6 overflow-y-auto">
              <TaskDetailDescription
                taskId={displayTask.id}
                initialDescription={displayTask.description}
              />
              {displayTask.id && displayTask.projectId && (
                <div className="border-t pt-6">
                  <TaskComments taskId={displayTask.id} projectId={displayTask.projectId} />
                </div>
              )}
              {displayTask.id && (
                <div className="border-t pt-6">
                  <TaskActivityFeed taskId={displayTask.id} />
                </div>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
