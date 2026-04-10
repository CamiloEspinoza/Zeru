"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface EditInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onTitleChange: (title: string) => void;
  interviewDate: string;
  onDateChange: (date: string) => void;
  objective: string;
  onObjectiveChange: (objective: string) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditInterviewDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  interviewDate,
  onDateChange,
  objective,
  onObjectiveChange,
  onSave,
  saving,
}: EditInterviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Entrevista</DialogTitle>
          <DialogDescription>
            Modifica los datos de la entrevista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-title">Título</Label>
            <Input
              id="edit-interview-title"
              placeholder="Título de la entrevista"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-date">Fecha</Label>
            <Input
              id="edit-interview-date"
              type="date"
              value={interviewDate}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-interview-objective">Objetivo</Label>
            <Textarea
              id="edit-interview-objective"
              placeholder="¿Qué se busca obtener de esta entrevista?"
              value={objective}
              onChange={(e) => onObjectiveChange(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
