"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { KanbanCard } from "./kanban-card";
import { CreateTaskDialog } from "../create-task-dialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon } from "@hugeicons/core-free-icons";
import type { Task, TaskStatusConfig } from "@/types/projects";

interface KanbanColumnProps {
  status: TaskStatusConfig;
  statuses: TaskStatusConfig[];
  tasks: Task[];
  projectId: string;
  projectKey: string;
  onTaskCreated: () => void;
  isOver: boolean;
}

export function KanbanColumn({
  status,
  statuses,
  tasks,
  projectId,
  projectKey,
  onTaskCreated,
  isOver,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: `column-${status.id}`,
    data: { type: "column", statusId: status.id },
  });

  const color = status.color ?? "#6B7280";

  return (
    <div
      className={`flex w-72 shrink-0 flex-col rounded-lg bg-muted/40 transition-colors ${
        isOver ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderTopColor: color, borderTopWidth: 3 }}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{status.name}</h3>
          <span className="text-xs text-muted-foreground">{tasks.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className="flex min-h-[100px] flex-1 flex-col gap-1 p-2"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} projectKey={projectKey} />
          ))}
        </SortableContext>
        <CreateTaskDialog
          projectId={projectId}
          statuses={statuses}
          defaultStatusId={status.id}
          onCreated={onTaskCreated}
          trigger={
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
            >
              <HugeiconsIcon icon={PlusSignIcon} className="mr-2 size-4" />
              Agregar tarea
            </Button>
          }
        />
      </div>
    </div>
  );
}
