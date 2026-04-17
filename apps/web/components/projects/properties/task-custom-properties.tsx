"use client";

import * as React from "react";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import { PropertyValueRenderer } from "./property-value-renderer";
import type {
  ProjectPropertyDefinition,
  TaskPropertyValue,
  SetPropertyValuePayload,
} from "@/types/custom-properties";
import type { ProjectMember } from "@/types/projects";
import { cn } from "@/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  TextIcon,
  Calculator01Icon,
  ArrowDown01Icon,
  Calendar03Icon,
  UserIcon,
  CheckmarkSquare01Icon,
  Link01Icon,
  MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import type { PropertyType } from "@/types/custom-properties";

const TYPE_ICONS: Record<PropertyType, typeof TextIcon> = {
  TEXT: TextIcon,
  NUMBER: Calculator01Icon,
  SELECT: ArrowDown01Icon,
  MULTI_SELECT: MoreHorizontalIcon,
  DATE: Calendar03Icon,
  PERSON: UserIcon,
  CHECKBOX: CheckmarkSquare01Icon,
  URL: Link01Icon,
};

interface TaskCustomPropertiesProps {
  taskId: string;
  projectId: string;
  members?: ProjectMember[];
  disabled?: boolean;
}

export function TaskCustomProperties({
  taskId,
  projectId,
  members = [],
  disabled = false,
}: TaskCustomPropertiesProps) {
  const [definitions, setDefinitions] = React.useState<
    ProjectPropertyDefinition[]
  >([]);
  const [values, setValues] = React.useState<TaskPropertyValue[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!projectId || !taskId) return;
    let cancelled = false;

    async function load() {
      try {
        const [defs, vals] = await Promise.all([
          projectsApi.listProperties(projectId),
          tasksApi.getPropertyValues(taskId),
        ]);
        if (!cancelled) {
          setDefinitions(defs);
          setValues(vals);
        }
      } catch (err) {
        console.error("Failed to load custom properties", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [projectId, taskId]);

  const handleSave = React.useCallback(
    async (propertyId: string, payload: SetPropertyValuePayload) => {
      try {
        const updated = await tasksApi.setPropertyValue(
          taskId,
          propertyId,
          payload,
        );
        setValues((prev) => {
          const idx = prev.findIndex(
            (v) => v.propertyDefinitionId === propertyId,
          );
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = updated;
            return copy;
          }
          return [...prev, updated];
        });
      } catch (err) {
        console.error("Failed to save property value", err);
      }
    },
    [taskId],
  );

  const handleClear = React.useCallback(
    async (propertyId: string) => {
      try {
        await tasksApi.clearPropertyValue(taskId, propertyId);
        setValues((prev) =>
          prev.filter((v) => v.propertyDefinitionId !== propertyId),
        );
      } catch (err) {
        console.error("Failed to clear property value", err);
      }
    },
    [taskId],
  );

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 flex-1 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (definitions.length === 0) {
    return null;
  }

  const valuesMap = new Map(
    values.map((v) => [v.propertyDefinitionId, v]),
  );

  return (
    <div className="space-y-1.5">
      {definitions.map((def) => {
        const val = valuesMap.get(def.id) ?? null;
        const isEmpty = val === null;
        const TypeIcon = TYPE_ICONS[def.type] ?? TextIcon;

        return (
          <div
            key={def.id}
            className={cn(
              "flex items-start gap-2",
              def.isRequired &&
                isEmpty &&
                "bg-amber-50/50 dark:bg-amber-950/20 rounded px-1 py-0.5",
            )}
          >
            <div className="flex items-center gap-1.5 min-w-[100px] pt-1.5 shrink-0">
              <HugeiconsIcon
                icon={TypeIcon}
                strokeWidth={2}
                className="size-3.5 text-muted-foreground"
              />
              <span
                className="text-xs text-muted-foreground truncate"
                title={def.name}
              >
                {def.name}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <PropertyValueRenderer
                definition={def}
                value={val}
                members={members}
                onSave={(payload) => handleSave(def.id, payload)}
                onClear={() => handleClear(def.id)}
                disabled={disabled}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
