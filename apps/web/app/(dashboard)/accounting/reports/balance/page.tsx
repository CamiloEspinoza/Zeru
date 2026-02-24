"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import type { FiscalPeriod } from "@zeru/shared";

interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  period_debits: string;
  period_credits: string;
  balance: string;
}

export default function TrialBalancePage() {
  const { tenant } = useTenantContext();
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    api
      .get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId })
      .then((periods) => {
        setPeriods(periods);
        if (periods.length > 0 && !selectedPeriodId) {
          setSelectedPeriodId(periods[0].id);
        }
      })
      .catch((err) => setError(err.message ?? "Error al cargar períodos"));
  }, [tenant?.id]);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !selectedPeriodId) return;

    setLoading(true);
    setError(null);
    const url = `/accounting/reports/trial-balance?fiscalPeriodId=${selectedPeriodId}`;
    api
      .get<TrialBalanceRow[]>(url, { tenantId })
      .then(setData)
      .catch((err) => setError(err.message ?? "Error al cargar reporte"))
      .finally(() => setLoading(false));
  }, [tenant?.id, selectedPeriodId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Balance de Comprobación</h1>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Período fiscal</Label>
              <Select
                value={selectedPeriodId}
                onValueChange={setSelectedPeriodId}
                disabled={!periods.length}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Seleccionar período" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-destructive mb-4">{error}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Código</th>
                    <th className="text-left py-2 px-3 font-medium">Cuenta</th>
                    <th className="text-right py-2 px-3 font-medium">Debe</th>
                    <th className="text-right py-2 px-3 font-medium">Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row) => (
                    <tr key={row.account_id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono">{row.code}</td>
                      <td className="py-2 px-3">{row.name}</td>
                      <td className="py-2 px-3 text-right">
                        {formatCLP(parseFloat(row.period_debits))}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {formatCLP(parseFloat(row.period_credits))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
