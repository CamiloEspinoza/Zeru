"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import type { Label } from "@/types/projects";

interface TaskLabelSelectProps {
  taskId: string;
  projectId: string;
  currentLabels: Array<{ labelId: string; label: Label }>;
  onUpdated?: () => void;
}

export function TaskLabelSelect({
  taskId,
  projectId,
  currentLabels,
  onUpdated,
}: TaskLabelSelectProps) {
  const [open, setOpen] = useState(false);
  const [allLabels, setAllLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedIds = new Set(currentLabels.map((l) => l.labelId));

  const fetchLabels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.listLabels(projectId);
      setAllLabels(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && allLabels.length === 0) {
      fetchLabels();
    }
  }, [open, allLabels.length, fetchLabels]);

  async function handleToggle(labelId: string) {
    try {
      if (selectedIds.has(labelId)) {
        await tasksApi.removeLabel(taskId, labelId);
      } else {
        await tasksApi.addLabel(taskId, labelId);
      }
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar etiquetas");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs font-medium justify-start gap-1 flex-wrap"
        >
          {currentLabels.length === 0 ? (
            <span className="text-muted-foreground">Sin etiquetas</span>
          ) : (
            currentLabels.map((l) => (
              <Badge
                key={l.labelId}
                variant="outline"
                className="text-[10px] px-1.5 py-0"
                style={{
                  borderColor: l.label.color,
                  color: l.label.color,
                  backgroundColor: `${l.label.color}15`,
                }}
              >
                {l.label.name}
              </Badge>
            ))
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">Cargando...</p>
        ) : (
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {allLabels.map((label) => {
              const isSelected = selectedIds.has(label.id);
              return (
                <button
                  key={label.id}
                  onClick={() => handleToggle(label.id)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <span
                    className="size-3 rounded-sm shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="truncate flex-1 text-left">{label.name}</span>
                  {isSelected && (
                    <span className="text-xs text-primary">&#10003;</span>
                  )}
                </button>
              );
            })}
            {allLabels.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                No hay etiquetas
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
