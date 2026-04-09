"use client";

import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { useProjectStore } from "@/stores/project-store";
import { tasksApi } from "@/lib/api/tasks";
import { positionBetween } from "@/lib/fractional-position";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface KanbanBoardProps {
  projectId: string;
  projectKey: string;
  statuses: TaskStatusConfig[];
  tasks: Task[];
  onRefetch: () => void;
}

export function KanbanBoard({ projectId, projectKey, statuses, tasks, onRefetch }: KanbanBoardProps) {
  const patchTask = useProjectStore((s) => s.patchTask);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const tasksByStatus = new Map<string, Task[]>();
  for (const status of statuses) {
    tasksByStatus.set(
      status.id,
      tasks
        .filter((t) => t.statusId === status.id && !t.parentId)
        .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0)),
    );
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target status
    let targetStatusId: string | null = null;
    if (over.data.current?.type === "column") {
      targetStatusId = over.data.current.statusId as string;
    } else if (over.data.current?.type === "task") {
      const overTask = over.data.current.task as Task;
      targetStatusId = overTask.statusId;
    }

    if (!targetStatusId) return;

    const columnTasks = tasksByStatus.get(targetStatusId) ?? [];
    const overIndex = over.data.current?.type === "task"
      ? columnTasks.findIndex((t) => t.id === over.id)
      : columnTasks.length;

    const beforeTask = overIndex > 0 ? columnTasks[overIndex - 1] : null;
    const afterTask = overIndex >= 0 && overIndex < columnTasks.length ? columnTasks[overIndex] : null;

    // Skip if dropped on itself in same position
    if (beforeTask?.id === taskId || afterTask?.id === taskId) return;

    const newPosition = positionBetween(
      beforeTask?.position ?? null,
      afterTask?.position ?? null,
    );

    // Optimistic update
    const previousStatusId = task.statusId;
    const previousPosition = task.position;
    patchTask(projectId, taskId, { statusId: targetStatusId, position: newPosition });

    try {
      await tasksApi.move(taskId, {
        statusId: targetStatusId,
        position: newPosition,
      });
    } catch (err) {
      // Rollback
      patchTask(projectId, taskId, { statusId: previousStatusId, position: previousPosition });
      toast.error(err instanceof Error ? err.message : "No se pudo mover la tarea");
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            statuses={statuses}
            tasks={tasksByStatus.get(status.id) ?? []}
            projectId={projectId}
            projectKey={projectKey}
            onTaskCreated={onRefetch}
          />
        ))}
      </div>
    </DndContext>
  );
}
