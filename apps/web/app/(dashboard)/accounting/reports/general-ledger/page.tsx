"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import type { Account, FiscalPeriod } from "@zeru/shared";

interface AccountWithChildren extends Account {
  children?: AccountWithChildren[];
}

function flattenAccounts(accounts: AccountWithChildren[]): Account[] {
  const result: Account[] = [];
  function traverse(items: AccountWithChildren[]) {
    for (const item of items) {
      const { children, ...account } = item;
      result.push(account);
      if (children?.length) traverse(children);
    }
  }
  traverse(accounts);
  return result;
}

interface GeneralLedgerRow {
  entry_date: string;
  entry_number: number;
  description: string;
  debit: string;
  credit: string;
  running_balance: string;
}

export default function GeneralLedgerPage() {
  const { tenant } = useTenantContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<GeneralLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    Promise.all([
      api.get<AccountWithChildren[]>("/accounting/accounts", { tenantId }),
      api.get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId }),
    ])
      .then(([accs, perds]) => {
        setAccounts(flattenAccounts(accs));
        setPeriods(perds);
        if (perds.length > 0) {
          const p = perds[0];
          setStartDate(p.startDate.toString().slice(0, 10));
          setEndDate(p.endDate.toString().slice(0, 10));
        }
        if (accs.length > 0 && !selectedAccountId) {
          setSelectedAccountId(flattenAccounts(accs)[0].id);
        }
      })
      .catch((err) => setError(err.message ?? "Error al cargar datos"));
  }, [tenant?.id]);

  const handleSearch = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !selectedAccountId || !startDate || !endDate) return;

    setLoading(true);
    setError(null);
    setHasSearched(true);
    const params = new URLSearchParams({
      accountId: selectedAccountId,
      startDate,
      endDate,
    });
    api
      .get<GeneralLedgerRow[]>(
        `/accounting/reports/general-ledger?${params.toString()}`,
        { tenantId }
      )
      .then(setData)
      .catch((err) => setError(err.message ?? "Error al cargar reporte"))
      .finally(() => setLoading(false));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Libro Mayor</h1>
        <p className="text-muted-foreground">
          Movimientos detallados por cuenta.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
                disabled={!accounts.length}
              >
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Desde</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <div className="space-y-2">
              <Label>Hasta</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-[140px]"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading}>
              Buscar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="text-destructive mb-4">{error}</p>
          )}
          {loading ? (
            <p className="text-muted-foreground">Cargando...</p>
          ) : hasSearched ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">Fecha</th>
                    <th className="text-left py-2 px-3 font-medium">Asiento</th>
                    <th className="text-left py-2 px-3 font-medium">Descripción</th>
                    <th className="text-right py-2 px-3 font-medium">Debe</th>
                    <th className="text-right py-2 px-3 font-medium">Haber</th>
                    <th className="text-right py-2 px-3 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 px-3">
                        {new Date(row.entry_date).toLocaleDateString("es-CL")}
                      </td>
                      <td className="py-2 px-3">#{row.entry_number}</td>
                      <td className="py-2 px-3">{row.description}</td>
                      <td className="py-2 px-3 text-right">
                        {parseFloat(row.debit) > 0
                          ? formatCLP(parseFloat(row.debit))
                          : "—"}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {parseFloat(row.credit) > 0
                          ? formatCLP(parseFloat(row.credit))
                          : "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-medium">
                        {formatCLP(parseFloat(row.running_balance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Selecciona cuenta y rango de fechas, luego haz clic en Buscar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
