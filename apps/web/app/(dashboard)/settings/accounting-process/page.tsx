"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import type { AccountingProcessStep } from "@zeru/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUp01Icon,
  ArrowDown01Icon,
  Delete02Icon,
  Add01Icon,
  Loading02Icon,
  FloppyDiskIcon,
  Cancel01Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons";

// ─── Editable step row ────────────────────────────────────────────

interface StepRowProps {
  step: AccountingProcessStep;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, name: string, description: string) => void;
}

function StepRow({
  step,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSave,
}: StepRowProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(step.name);
  const [description, setDescription] = useState(step.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave(step.id, name.trim(), description.trim());
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setName(step.name);
    setDescription(step.description ?? "");
    setEditing(false);
  };

  return (
    <div className="flex items-start gap-3 py-3 px-3 rounded-md border bg-card hover:bg-muted/20 transition-colors">
      {/* Drag handle / order */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
        <button
          onClick={() => onMoveUp(step.id)}
          disabled={isFirst}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Subir"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} className="size-3.5" />
        </button>
        <span className="text-[10px] text-muted-foreground font-mono w-4 text-center">
          {step.order + 1}
        </span>
        <button
          onClick={() => onMoveDown(step.id)}
          disabled={isLast}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          title="Bajar"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del paso"
              className="h-8 text-sm"
              autoFocus
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción (opcional)"
              rows={2}
              className="text-sm resize-none"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin mr-1" />
                ) : (
                  <HugeiconsIcon icon={FloppyDiskIcon} className="size-3 mr-1" />
                )}
                Guardar
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <HugeiconsIcon icon={Cancel01Icon} className="size-3 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium">{step.name}</p>
            {step.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {step.description}
              </p>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Editar"
          >
            <HugeiconsIcon icon={Edit02Icon} className="size-4" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Eliminar"
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este paso?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminará &ldquo;{step.name}&rdquo; y todos sus registros de
                  completitud históricos. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(step.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

// ─── Add step form ────────────────────────────────────────────────

interface AddStepFormProps {
  onAdd: (name: string, description: string) => Promise<void>;
}

function AddStepForm({ onAdd }: AddStepFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), description.trim());
    setName("");
    setDescription("");
    setSaving(false);
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="w-full"
      >
        <HugeiconsIcon icon={Add01Icon} className="size-4 mr-2" />
        Agregar paso
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border rounded-md p-3 space-y-2 bg-muted/20"
    >
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre del paso</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Contabilización de Ventas"
          className="h-8 text-sm"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Descripción (opcional)</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción del paso..."
          rows={2}
          className="text-sm resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !name.trim()}>
          {saving ? (
            <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin mr-1" />
          ) : (
            <HugeiconsIcon icon={Add01Icon} className="size-3 mr-1" />
          )}
          Agregar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setName("");
            setDescription("");
          }}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}

// ─── Main page ────────────────────────────────────────────────────

export default function AccountingProcessPage() {
  const { tenant } = useTenantContext();
  const [steps, setSteps] = useState<AccountingProcessStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenant_id") ?? "" : "");

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    api
      .get<AccountingProcessStep[]>("/accounting/process/steps", { tenantId })
      .then(setSteps)
      .catch((err) => setError(err.message ?? "Error al cargar pasos"))
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (name: string, description: string) => {
    const order = steps.length;
    const newStep = await api.post<AccountingProcessStep>(
      "/accounting/process/steps",
      { name, description, order },
      { tenantId }
    );
    setSteps((prev) => [...prev, newStep]);
  };

  const handleSave = async (id: string, name: string, description: string) => {
    const updated = await api.patch<AccountingProcessStep>(
      `/accounting/process/steps/${id}`,
      { name, description },
      { tenantId }
    );
    setSteps((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/accounting/process/steps/${id}`, { tenantId });
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, order: i }));
    });
    // Persist reordered indices
    const reordered = steps
      .filter((s) => s.id !== id)
      .map((s, i) => ({ id: s.id, order: i }));
    if (reordered.length > 0) {
      await api.patch(
        "/accounting/process/steps/reorder",
        { steps: reordered },
        { tenantId }
      );
    }
  };

  const move = async (id: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= steps.length) return;

    const reordered = [...steps];
    [reordered[idx], reordered[targetIdx]] = [reordered[targetIdx], reordered[idx]];
    const withOrder = reordered.map((s, i) => ({ ...s, order: i }));
    setSteps(withOrder);

    await api.patch(
      "/accounting/process/steps/reorder",
      { steps: withOrder.map((s) => ({ id: s.id, order: s.order })) },
      { tenantId }
    );
  };

  const handleLoadDefaults = async () => {
    setLoadingDefaults(true);
    setError(null);
    try {
      const result = await api.post<AccountingProcessStep[]>(
        "/accounting/process/steps/load-defaults",
        {},
        { tenantId }
      );
      setSteps(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al cargar plantilla";
      setError(msg);
    } finally {
      setLoadingDefaults(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Proceso Contable</h1>
        <p className="text-muted-foreground">
          Configura los pasos del proceso contable mensual de tu organización.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pasos del proceso</CardTitle>
            {steps.length === 0 && !loading && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLoadDefaults}
                disabled={loadingDefaults}
              >
                {loadingDefaults ? (
                  <HugeiconsIcon
                    icon={Loading02Icon}
                    className="size-3.5 animate-spin mr-2"
                  />
                ) : null}
                Cargar plantilla predeterminada
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
              <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
              Cargando pasos...
            </div>
          ) : steps.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                No hay pasos configurados todavía.
              </p>
              <p className="text-xs text-muted-foreground">
                Agrega pasos manualmente o carga la plantilla predeterminada.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {steps.map((step, idx) => (
                <StepRow
                  key={step.id}
                  step={step}
                  isFirst={idx === 0}
                  isLast={idx === steps.length - 1}
                  onMoveUp={(id) => move(id, "up")}
                  onMoveDown={(id) => move(id, "down")}
                  onDelete={handleDelete}
                  onSave={handleSave}
                />
              ))}
            </div>
          )}

          <AddStepForm onAdd={handleAdd} />
        </CardContent>
      </Card>

      <div className="text-xs text-muted-foreground">
        Los pasos aquí configurados aparecerán en el dashboard para hacer seguimiento del
        proceso contable mensual de cada período fiscal.
      </div>
    </div>
  );
}
