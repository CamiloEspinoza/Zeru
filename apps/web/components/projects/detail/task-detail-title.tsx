"use client";

import { useAutosaveField } from "@/hooks/use-autosave-field";
import { FieldLockIndicator } from "@/components/projects/field-lock-indicator";
import { tasksApi } from "@/lib/api/tasks";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TaskDetailTitleProps {
  taskId: string;
  initialTitle: string;
}

export function TaskDetailTitle({ taskId, initialTitle }: TaskDetailTitleProps) {
  const { value, setValue, isSaving, isLockedByOther, lockedByName, onFocus, onBlur } =
    useAutosaveField<string>({
      entityType: "Task",
      entityId: taskId,
      fieldName: "title",
      initialValue: initialTitle,
      save: async (v) => {
        await tasksApi.update(taskId, { title: v });
      },
    });

  return (
    <div className="space-y-1">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={isLockedByOther}
        placeholder="Título de la tarea"
        className={cn(
          "border-transparent text-xl font-semibold shadow-none focus-visible:border-input",
          isLockedByOther && "opacity-60",
        )}
      />
      <div className="flex items-center gap-3 px-3">
        <FieldLockIndicator lockedByName={lockedByName} />
        {isSaving && <span className="text-xs text-muted-foreground">Guardando...</span>}
      </div>
    </div>
  );
}
