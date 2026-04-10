"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { tasksApi } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";

interface TaskDueDatePickerProps {
  taskId: string;
  currentDueDate: string | null;
  onUpdated?: (dueDate: string | null) => void;
}

export function TaskDueDatePicker({
  taskId,
  currentDueDate,
  onUpdated,
}: TaskDueDatePickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const dateValue = currentDueDate ? new Date(currentDueDate) : undefined;
  const isOverdue = dateValue ? dateValue < new Date() : false;

  async function handleSelect(date: Date | undefined) {
    setSaving(true);
    try {
      const dueDate = date ? date.toISOString() : null;
      await tasksApi.update(taskId, { dueDate });
      onUpdated?.(dueDate);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar fecha");
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    await handleSelect(undefined);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-auto px-2 py-1 text-xs font-medium justify-start",
            isOverdue && "text-destructive",
          )}
          disabled={saving}
        >
          {dateValue
            ? format(dateValue, "d MMM yyyy", { locale: es })
            : "Sin fecha"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleSelect}
          initialFocus
        />
        {currentDueDate && (
          <div className="border-t px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-destructive"
              onClick={handleClear}
            >
              Quitar fecha
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
