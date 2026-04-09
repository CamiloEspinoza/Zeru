"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TableCell, TableRow } from "@/components/ui/table";
import { TaskStatusBadge } from "@/components/projects/task-status-badge";
import { TaskPriorityBadge } from "@/components/projects/task-priority-badge";
import { TaskAssigneeAvatars } from "@/components/projects/task-assignee-avatars";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface TaskListRowProps {
  task: Task;
  projectKey: string;
  statuses: TaskStatusConfig[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
  });
}

export function TaskListRow({ task, projectKey, statuses }: TaskListRowProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const status = statuses.find((s) => s.id === task.statusId);

  function handleClick() {
    const params = new URLSearchParams(searchParams);
    params.set("task", task.id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <TableRow onClick={handleClick} className="cursor-pointer hover:bg-accent/40">
      <TableCell className="font-mono text-xs text-muted-foreground">
        {projectKey}-{task.number}
      </TableCell>
      <TableCell className="font-medium">{task.title}</TableCell>
      <TableCell>{status && <TaskStatusBadge status={status} />}</TableCell>
      <TableCell>
        <TaskPriorityBadge priority={task.priority} />
      </TableCell>
      <TableCell>
        {task.assignees && task.assignees.length > 0 ? (
          <TaskAssigneeAvatars assignees={task.assignees} max={3} />
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {formatDate(task.dueDate)}
      </TableCell>
    </TableRow>
  );
}
