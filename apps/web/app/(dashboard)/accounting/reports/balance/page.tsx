"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const periodId = searchParams.get("fiscalPeriodId") ?? "";

  const setFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams();
      if (value) params.set("fiscalPeriodId", value);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  // Load periods once, set default if no URL param
  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    api
      .get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId })
      .then((perds) => {
        setPeriods(perds);
        if (!periodId && perds.length > 0) {
          setFilter(perds[0].id);
        }
      })
      .catch((err) => setError(err.message ?? "Error al cargar períodos"));
  }, [tenant?.id]);

  // Fetch report whenever periodId changes
  const lastFetchRef = useRef<string | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenant_id") : null);
    if (!tenantId || !periodId || periods.length === 0) return;
    if (!periods.some((p) => p.id === periodId)) return;
    if (lastFetchRef.current === periodId) return;
    lastFetchRef.current = periodId;

    setLoading(true);
    setError(null);
    api
      .get<TrialBalanceRow[]>(
        `/accounting/reports/trial-balance?fiscalPeriodId=${periodId}`,
        { tenantId }
      )
      .then(setData)
      .catch((err) => setError(err.message ?? "Error al cargar reporte"))
      .finally(() => setLoading(false));
  }, [tenant?.id, periodId, periods]);

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
                value={periodId}
                onValueChange={setFilter}
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
