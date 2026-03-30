"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import type { FiscalPeriod, FiscalPeriodStatus } from "@zeru/shared";

const STATUS_BADGE: Record<
  FiscalPeriodStatus,
  { variant: "default" | "secondary" | "outline"; label: string }
> = {
  OPEN: { variant: "secondary", label: "Abierto" },
  CLOSED: { variant: "outline", label: "Cerrado" },
};

export default function PeriodsPage() {
  const { tenant } = useTenantContext();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  // New period dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Close period confirmation dialog state
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [periodToClose, setPeriodToClose] = useState<FiscalPeriod | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) {
      setLoading(false);
      return;
    }

    api
      .get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId })
      .then(setPeriods)
      .catch((err) => setError(err.message ?? "Error al cargar períodos"))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const handleClose = async (id: string) => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setClosingId(id);
    setCloseConfirmOpen(false);
    setPeriodToClose(null);
    try {
      await api.patch(`/accounting/fiscal-periods/${id}/close`, {}, { tenantId });
      const updated = await api.get<FiscalPeriod[]>(
        "/accounting/fiscal-periods",
        { tenantId }
      );
      setPeriods(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cerrar período");
    } finally {
      setClosingId(null);
    }
  };

  const handleCreate = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setCreateError(null);

    if (!newName.trim() || !newStartDate || !newEndDate) {
      setCreateError("Todos los campos son obligatorios.");
      return;
    }

    setCreating(true);
    try {
      await api.post(
        "/accounting/fiscal-periods",
        { name: newName.trim(), startDate: newStartDate, endDate: newEndDate },
        { tenantId }
      );
      const updated = await api.get<FiscalPeriod[]>(
        "/accounting/fiscal-periods",
        { tenantId }
      );
      setPeriods(updated);
      setCreateOpen(false);
      setNewName("");
      setNewStartDate("");
      setNewEndDate("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Error al crear período"
      );
    } finally {
      setCreating(false);
    }
  };

  const openCloseConfirmation = (period: FiscalPeriod) => {
    setPeriodToClose(period);
    setCloseConfirmOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Períodos Fiscales</h1>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Períodos Fiscales</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Períodos Fiscales</h1>
        <Button onClick={() => setCreateOpen(true)}>Nuevo Período</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Períodos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Nombre</th>
                  <th className="text-left py-2 px-3 font-medium">Inicio</th>
                  <th className="text-left py-2 px-3 font-medium">Fin</th>
                  <th className="text-left py-2 px-3 font-medium">Estado</th>
                  <th className="text-left py-2 px-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((period) => {
                  const statusConfig = STATUS_BADGE[period.status];
                  return (
                    <tr key={period.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{period.name}</td>
                      <td className="py-2 px-3">
                        {new Date(period.startDate).toLocaleDateString("es-CL")}
                      </td>
                      <td className="py-2 px-3">
                        {new Date(period.endDate).toLocaleDateString("es-CL")}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant={statusConfig.variant}>
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="py-2 px-3">
                        {period.status === "OPEN" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCloseConfirmation(period)}
                            disabled={closingId === period.id}
                          >
                            Cerrar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Nuevo Período */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Período Fiscal</DialogTitle>
            <DialogDescription>
              Ingresa los datos del nuevo período fiscal. Una vez creado, quedará en estado abierto.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="period-name">Nombre</Label>
              <Input
                id="period-name"
                placeholder="Ej: Enero 2026"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-start">Fecha de inicio</Label>
              <Input
                id="period-start"
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">Fecha de fin</Label>
              <Input
                id="period-end"
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>
            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creando..." : "Crear período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar cierre de período */}
      <Dialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cerrar período fiscal?</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Una vez cerrado, no se podrán registrar
              ni modificar asientos contables en el período
              {periodToClose ? ` "${periodToClose.name}"` : ""}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCloseConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => periodToClose && handleClose(periodToClose.id)}
              disabled={!!closingId}
            >
              {closingId ? "Cerrando..." : "Cerrar período"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
