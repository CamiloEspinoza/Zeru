"use client";

import { useAutosaveField } from "@/hooks/use-autosave-field";
import { FieldLockIndicator } from "@/components/projects/field-lock-indicator";
import { tasksApi } from "@/lib/api/tasks";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TaskDetailDescriptionProps {
  taskId: string;
  initialDescription: string | null;
}

export function TaskDetailDescription({
  taskId,
  initialDescription,
}: TaskDetailDescriptionProps) {
  const { value, setValue, isSaving, isLockedByOther, lockedByName, onFocus, onBlur } =
    useAutosaveField<string>({
      entityType: "Task",
      entityId: taskId,
      fieldName: "description",
      initialValue: initialDescription ?? "",
      save: async (v) => {
        await tasksApi.update(taskId, { description: v.trim() ? v : null });
      },
    });

  return (
    <div className="space-y-1">
      <h3 className="mb-2 text-sm font-medium">Descripción</h3>
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        disabled={isLockedByOther}
        placeholder="Añade una descripción..."
        rows={5}
        maxLength={50000}
        className={cn(isLockedByOther && "opacity-60")}
      />
      <div className="flex items-center gap-3">
        <FieldLockIndicator lockedByName={lockedByName} />
        {isSaving && <span className="text-xs text-muted-foreground">Guardando...</span>}
      </div>
    </div>
  );
}
