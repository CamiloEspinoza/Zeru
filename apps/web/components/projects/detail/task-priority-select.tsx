"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskPriority } from "@/types/projects";

const PRIORITIES: Array<{ value: TaskPriority; label: string; color: string }> = [
  { value: "URGENT", label: "Urgente", color: "#DC2626" },
  { value: "HIGH", label: "Alta", color: "#EA580C" },
  { value: "MEDIUM", label: "Media", color: "#CA8A04" },
  { value: "LOW", label: "Baja", color: "#2563EB" },
  { value: "NONE", label: "Sin prioridad", color: "#6B7280" },
];

interface TaskPrioritySelectProps {
  taskId: string;
  currentPriority: TaskPriority;
  onUpdated?: (priority: TaskPriority) => void;
}

export function TaskPrioritySelect({
  taskId,
  currentPriority,
  onUpdated,
}: TaskPrioritySelectProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = PRIORITIES.find((p) => p.value === currentPriority) ?? PRIORITIES[4];

  async function handleSelect(priority: TaskPriority) {
    if (priority === currentPriority) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await tasksApi.update(taskId, { priority });
      onUpdated?.(priority);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar prioridad");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs font-medium justify-start"
          disabled={saving}
        >
          <span
            className="mr-1.5 size-2.5 rounded-full shrink-0"
            style={{ backgroundColor: current.color }}
          />
          {current.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-1" align="start">
        <div className="space-y-0.5">
          {PRIORITIES.map((p) => (
            <button
              key={p.value}
              onClick={() => handleSelect(p.value)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.label}</span>
              {p.value === currentPriority && (
                <span className="ml-auto text-xs text-muted-foreground">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
