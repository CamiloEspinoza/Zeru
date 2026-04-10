"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { tasksApi } from "@/lib/api/tasks";
import type { TaskStatusConfig } from "@/types/projects";

interface TaskStatusSelectProps {
  taskId: string;
  currentStatusId: string;
  statuses: TaskStatusConfig[];
  onUpdated?: (statusId: string) => void;
}

export function TaskStatusSelect({
  taskId,
  currentStatusId,
  statuses,
  onUpdated,
}: TaskStatusSelectProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = statuses.find((s) => s.id === currentStatusId);

  async function handleSelect(statusId: string) {
    if (statusId === currentStatusId) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await tasksApi.update(taskId, { statusId });
      onUpdated?.(statusId);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
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
            style={{ backgroundColor: current?.color ?? "#6B7280" }}
          />
          {current?.name ?? "Sin estado"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="start">
        <div className="space-y-0.5">
          {statuses.map((status) => (
            <button
              key={status.id}
              onClick={() => handleSelect(status.id)}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: status.color ?? "#6B7280" }}
              />
              <span className="truncate">{status.name}</span>
              {status.id === currentStatusId && (
                <span className="ml-auto text-xs text-muted-foreground">&#10003;</span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
