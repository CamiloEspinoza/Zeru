"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Períodos Fiscales</h1>
        <p className="text-muted-foreground">Cargando...</p>
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
        <Button>Nuevo Período</Button>
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
                            onClick={() => handleClose(period.id)}
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
    </div>
  );
}
