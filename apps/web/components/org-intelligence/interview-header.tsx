"use client";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/org-intelligence/status-badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Edit02Icon, Delete02Icon } from "@hugeicons/core-free-icons";

interface InterviewHeaderProps {
  title: string | null;
  date: string | null;
  currentStatus: string;
  onEdit: () => void;
  onReprocess: () => void;
  onDelete: () => void;
  projectId: string;
  reprocessing?: boolean;
}

export function InterviewHeader({
  title,
  date,
  currentStatus,
  onEdit,
  onReprocess,
  onDelete,
  projectId,
  reprocessing = false,
}: InterviewHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">
            {title ?? "Entrevista sin título"}
          </h1>
          <StatusBadge type="processing" value={currentStatus} />
        </div>
        {date && <p className="text-xs text-muted-foreground">{date}</p>}
      </div>
      <div className="flex items-center gap-2">
        {currentStatus !== "PENDING" && currentStatus !== "UPLOADED" && (
          <Button
            variant="outline"
            onClick={onReprocess}
            disabled={reprocessing}
          >
            {reprocessing
              ? "Procesando..."
              : currentStatus === "FAILED"
                ? "Reintentar"
                : currentStatus === "COMPLETED"
                  ? "Reprocesar"
                  : "Reiniciar desde..."}
          </Button>
        )}
        <Button variant="outline" size="icon" onClick={onEdit}>
          <HugeiconsIcon icon={Edit02Icon} className="size-4" />
          <span className="sr-only">Editar entrevista</span>
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-4" />
          <span className="sr-only">Eliminar entrevista</span>
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            (window.location.href = `/org-intelligence/projects/${projectId}`)
          }
        >
          Volver al proyecto
        </Button>
      </div>
    </div>
  );
}
