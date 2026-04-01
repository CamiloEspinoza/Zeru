"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface ReprocessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromStep: string;
  onFromStepChange: (step: string) => void;
  onReprocess: () => void;
  reprocessing: boolean;
}

export function ReprocessDialog({
  open,
  onOpenChange,
  fromStep,
  onFromStepChange,
  onReprocess,
  reprocessing,
}: ReprocessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reprocesar entrevista</DialogTitle>
          <DialogDescription>
            Elige desde qué paso reanudar. Los pasos anteriores se
            reutilizarán y los siguientes se ejecutarán desde cero.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <label className="text-sm font-medium">Comenzar desde</label>
          <select
            value={fromStep}
            onChange={(e) => onFromStepChange(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">Desde el inicio (completo)</option>
            <option value="EXTRACTING">
              Extracción (saltar transcripción)
            </option>
            <option value="RESOLVING_COREFERENCES">
              Reconciliación (saltar transcripción + extracción)
            </option>
            <option value="CHUNKING">
              Fragmentación (solo chunking + indexado)
            </option>
            <option value="EMBEDDING">Indexado (solo embeddings)</option>
          </select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reprocessing}
          >
            Cancelar
          </Button>
          <Button onClick={onReprocess} disabled={reprocessing}>
            {reprocessing ? "Procesando..." : fromStep ? "Reanudar" : "Reprocesar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
