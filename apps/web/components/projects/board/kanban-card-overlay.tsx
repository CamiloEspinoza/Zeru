"use client";

import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import type { Task } from "@/types/projects";

interface KanbanCardOverlayProps {
  task: Task;
  projectKey: string;
}

/** Rendered inside DragOverlay — a visual clone of the card that follows the cursor. */
export function KanbanCardOverlay({ task, projectKey }: KanbanCardOverlayProps) {
  const dueDate = task.dueDate ? new Date(task.dueDate) : null;
  const isOverdue = dueDate ? dueDate < new Date() && !task.completedAt : false;

  return (
    <div
      className={cn(
        "w-[272px] cursor-grabbing rounded-md border bg-card p-3 shadow-lg",
        "rotate-[2deg] scale-[1.02]",
      )}
    >
      {/* Labels */}
      {task.labels && task.labels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l.labelId}
              className="inline-block h-1.5 w-6 rounded-full"
              style={{ backgroundColor: l.label.color }}
              title={l.label.name}
            />
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 flex-1 text-sm font-medium">{task.title}</h3>
        <TaskPriorityBadge priority={task.priority} />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>
            {projectKey}-{task.number}
          </span>
          {dueDate && (
            <span
              className={cn(
                "flex items-center gap-0.5",
                isOverdue && "font-medium text-destructive",
              )}
            >
              {format(dueDate, "d MMM", { locale: es })}
            </span>
          )}
        </div>
        {task.assignees && task.assignees.length > 0 && (
          <TaskAssigneeAvatars assignees={task.assignees} max={3} />
        )}
      </div>
    </div>
  );
}
