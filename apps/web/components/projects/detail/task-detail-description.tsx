"use client";

import { useCallback } from "react";
import { useAutosaveField } from "@/hooks/use-autosave-field";
import { FieldLockIndicator } from "@/components/projects/field-lock-indicator";
import { tasksApi } from "@/lib/api/tasks";
import { uploadsApi } from "@/lib/api/uploads";
import { RichEditor } from "@/components/ui/rich-editor";
import { cn } from "@/lib/utils";

/**
 * Ensure content is valid HTML for the rich editor.
 * Old descriptions stored as plain text need to be wrapped in <p> tags.
 */
function ensureHtml(content: string): string {
  if (!content) return "";
  const trimmed = content.trim();
  if (trimmed.startsWith("<")) return trimmed;
  return trimmed
    .split("\n")
    .map((line) => `<p>${line || "<br>"}</p>`)
    .join("");
}

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
      initialValue: ensureHtml(initialDescription ?? ""),
      save: async (v) => {
        const trimmed = v.replace(/<p><\/p>/g, "").trim();
        await tasksApi.update(taskId, {
          description: trimmed && trimmed !== "<p></p>" ? v : null,
        });
      },
    });

  const handleImageUpload = useCallback(
    async (file: File): Promise<string> => {
      const result = await uploadsApi.uploadImage(file);
      return result.url;
    },
    [],
  );

  return (
    <div className="space-y-1">
      <h3 className="mb-2 text-sm font-medium">Descripcion</h3>
      <RichEditor
        content={value}
        onChange={setValue}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={!isLockedByOther}
        placeholder="Añade una descripcion..."
        onImageUpload={handleImageUpload}
        className={cn(isLockedByOther && "opacity-60")}
        minHeight="100px"
      />
      <div className="flex items-center gap-3">
        <FieldLockIndicator lockedByName={lockedByName} />
        {isSaving && <span className="text-xs text-muted-foreground">Guardando...</span>}
      </div>
    </div>
  );
}
