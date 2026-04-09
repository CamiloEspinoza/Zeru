"use client";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TaskListRow } from "./task-list-row";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface TaskListViewProps {
  tasks: Task[];
  projectKey: string;
  statuses: TaskStatusConfig[];
}

export function TaskListView({ tasks, projectKey, statuses }: TaskListViewProps) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No hay tareas en este proyecto todavía.
        </p>
      </div>
    );
  }

  const rootTasks = tasks
    .filter((t) => !t.parentId)
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0));

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">ID</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="w-32">Estado</TableHead>
            <TableHead className="w-24">Prioridad</TableHead>
            <TableHead className="w-28">Asignados</TableHead>
            <TableHead className="w-24">Vence</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rootTasks.map((task) => (
            <TaskListRow
              key={task.id}
              task={task}
              projectKey={projectKey}
              statuses={statuses}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
