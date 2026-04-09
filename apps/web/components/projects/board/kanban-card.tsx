"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import type { Task } from "@/types/projects";

interface KanbanCardProps {
  task: Task;
  projectKey: string;
}

export function KanbanCard({ task, projectKey }: KanbanCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleClick() {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={cn(
        "cursor-pointer rounded-md border bg-card p-3 shadow-sm hover:shadow-md transition-shadow",
        isDragging && "cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium line-clamp-2 flex-1">{task.title}</h3>
        <TaskPriorityBadge priority={task.priority} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {projectKey}-{task.number}
        </span>
        {task.assignees && task.assignees.length > 0 && (
          <TaskAssigneeAvatars assignees={task.assignees} max={3} />
        )}
      </div>
    </div>
  );
}
