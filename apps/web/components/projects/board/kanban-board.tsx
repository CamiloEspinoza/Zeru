"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { KanbanCardOverlay } from "./kanban-card-overlay";
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

type ColumnMap = Record<string, Task[]>;

/**
 * Custom collision detection for multi-column kanban.
 * Uses pointerWithin for columns (works in all directions),
 * falls back to rectIntersection for items within columns.
 */
const kanbanCollisionDetection: CollisionDetection = (args) => {
  // First check if pointer is within a droppable (column or task)
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  // Fallback to rect intersection
  return rectIntersection(args);
};

/**
 * Build a map of statusId -> sorted tasks (excluding subtasks).
 */
function buildColumnMap(statuses: TaskStatusConfig[], tasks: Task[]): ColumnMap {
  const map: ColumnMap = {};
  for (const status of statuses) {
    map[status.id] = [];
  }
  for (const task of tasks) {
    if (task.parentId) continue;
    if (map[task.statusId]) {
      map[task.statusId].push(task);
    }
  }
  for (const key of Object.keys(map)) {
    map[key].sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }
  return map;
}

/**
 * Find which column a task lives in within the column map.
 */
function findColumnOfTask(columns: ColumnMap, taskId: string): string | null {
  for (const [statusId, tasks] of Object.entries(columns)) {
    if (tasks.some((t) => t.id === taskId)) return statusId;
  }
  return null;
}

export function KanbanBoard({
  projectId,
  projectKey,
  statuses,
  tasks,
  onRefetch,
}: KanbanBoardProps) {
  const patchTask = useProjectStore((s) => s.patchTask);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Canonical column map from props (used as baseline when not dragging)
  const canonicalColumns = useMemo(
    () => buildColumnMap(statuses, tasks),
    [statuses, tasks],
  );

  // Live column state during drag (null when not dragging)
  const [columns, setColumns] = useState<ColumnMap | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Track the initial state at drag start for rollback
  const dragStartColumnsRef = useRef<ColumnMap | null>(null);

  const activeColumns = columns ?? canonicalColumns;

  const activeTask = useMemo(() => {
    if (!activeId) return null;
    return tasks.find((t) => t.id === activeId) ?? null;
  }, [activeId, tasks]);

  // --------------- DnD handlers ---------------

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as string;
      setActiveId(id);
      // Snapshot current canonical state as our working copy
      const snapshot = buildColumnMap(statuses, tasks);
      setColumns(snapshot);
      dragStartColumnsRef.current = snapshot;
    },
    [statuses, tasks],
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || !columns) return;

      const activeTaskId = active.id as string;
      const overId = over.id as string;

      // Determine the column being hovered over
      let overStatusId: string | null = null;

      if (over.data.current?.type === "column") {
        overStatusId = over.data.current.statusId as string;
      } else if (over.data.current?.type === "task") {
        overStatusId = findColumnOfTask(columns, overId);
      }

      if (!overStatusId) return;

      setOverColumnId(overStatusId);

      const activeStatusId = findColumnOfTask(columns, activeTaskId);
      if (!activeStatusId) return;

      // Same column reordering
      if (activeStatusId === overStatusId) {
        const columnTasks = [...columns[activeStatusId]];
        const oldIndex = columnTasks.findIndex((t) => t.id === activeTaskId);
        let newIndex: number;

        if (over.data.current?.type === "task") {
          newIndex = columnTasks.findIndex((t) => t.id === overId);
        } else {
          // Dropping on column itself — move to end
          newIndex = columnTasks.length - 1;
        }

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          setColumns((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              [activeStatusId]: arrayMove(
                [...prev[activeStatusId]],
                oldIndex,
                newIndex,
              ),
            };
          });
        }
        return;
      }

      // Cross-column movement
      setColumns((prev) => {
        if (!prev) return prev;

        const sourceTasks = [...prev[activeStatusId]];
        const destTasks = [...prev[overStatusId]];

        const activeIndex = sourceTasks.findIndex(
          (t) => t.id === activeTaskId,
        );
        if (activeIndex === -1) return prev;

        const [movedTask] = sourceTasks.splice(activeIndex, 1);

        // Insert at the position of the hovered task, or at end
        let insertIndex: number;
        if (over.data.current?.type === "task") {
          insertIndex = destTasks.findIndex((t) => t.id === overId);
          if (insertIndex === -1) insertIndex = destTasks.length;
        } else {
          insertIndex = destTasks.length;
        }

        destTasks.splice(insertIndex, 0, movedTask);

        return {
          ...prev,
          [activeStatusId]: sourceTasks,
          [overStatusId]: destTasks,
        };
      });
    },
    [columns],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const finalColumns = columns;

      // Reset drag state
      setActiveId(null);
      setOverColumnId(null);
      setColumns(null);

      if (!over || !finalColumns) return;

      const taskId = active.id as string;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      // Find where the task ended up in our local state
      const targetStatusId = findColumnOfTask(finalColumns, taskId);
      if (!targetStatusId) return;

      const columnTasks = finalColumns[targetStatusId];
      const taskIndex = columnTasks.findIndex((t) => t.id === taskId);
      if (taskIndex === -1) return;

      // Calculate fractional position based on neighbors
      const beforeTask = taskIndex > 0 ? columnTasks[taskIndex - 1] : null;
      const afterTask =
        taskIndex < columnTasks.length - 1
          ? columnTasks[taskIndex + 1]
          : null;

      // Skip if nothing changed
      if (
        targetStatusId === task.statusId &&
        !beforeTask &&
        !afterTask
      ) {
        return;
      }

      // Check if position actually changed
      if (targetStatusId === task.statusId) {
        const originalColumns = buildColumnMap(statuses, tasks);
        const originalIndex = originalColumns[targetStatusId].findIndex(
          (t) => t.id === taskId,
        );
        if (originalIndex === taskIndex) return;
      }

      const newPosition = positionBetween(
        beforeTask?.position ?? null,
        afterTask?.position ?? null,
      );

      // Optimistic update
      const previousStatusId = task.statusId;
      const previousPosition = task.position;
      patchTask(projectId, taskId, {
        statusId: targetStatusId,
        position: newPosition,
      });

      try {
        await tasksApi.move(taskId, {
          statusId: targetStatusId,
          position: newPosition,
        });
      } catch (err) {
        // Rollback
        patchTask(projectId, taskId, {
          statusId: previousStatusId,
          position: previousPosition,
        });
        toast.error(
          err instanceof Error ? err.message : "No se pudo mover la tarea",
        );
      }
    },
    [columns, tasks, statuses, projectId, patchTask],
  );

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setOverColumnId(null);
    setColumns(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex h-full gap-4 overflow-x-auto pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            statuses={statuses}
            tasks={activeColumns[status.id] ?? []}
            projectId={projectId}
            projectKey={projectKey}
            onTaskCreated={onRefetch}
            isOver={overColumnId === status.id}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <KanbanCardOverlay task={activeTask} projectKey={projectKey} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
