"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  onSave: () => void;
  saving: boolean;
}

export function EditInterviewDialog({
  open,
  onOpenChange,
  title,
  onTitleChange,
  onSave,
  saving,
}: EditInterviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Entrevista</DialogTitle>
          <DialogDescription>
            Modifica el título de la entrevista.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="edit-interview-title">Título</Label>
          <Input
            id="edit-interview-title"
            placeholder="Título de la entrevista"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
          />
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
