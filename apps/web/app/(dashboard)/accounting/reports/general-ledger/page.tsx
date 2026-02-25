"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import type { Account, FiscalPeriod } from "@zeru/shared";
import { downloadExcel } from "@/lib/export-excel";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

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

function getAccountLabel(accounts: AccountWithChildren[], accountId: string): string {
  const flat = flattenAccounts(accounts);
  const a = flat.find((x) => x.id === accountId);
  return a ? `${a.code} - ${a.name}` : "Seleccionar cuenta";
}

// ─── Tree selector row ─────────────────────────────────────────────

function AccountTreeRow({
  account,
  depth,
  selectedId,
  onSelect,
  onClose,
}: {
  account: AccountWithChildren;
  depth: number;
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasChildren = (account.children?.length ?? 0) > 0;
  const indent = depth * 16;

  const handleSelect = () => {
    onSelect(account.id);
    onClose();
  };

  return (
    <div className="min-w-0">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div
          className={cn(
            "flex items-center gap-1.5 py-1.5 pr-2 rounded-md cursor-pointer text-sm",
            "hover:bg-muted/60",
            selectedId === account.id && "bg-primary/10 text-primary"
          )}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="shrink-0 p-0.5 rounded hover:bg-muted"
                onClick={(e) => e.stopPropagation()}
              >
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className={cn(
                    "size-3.5 text-muted-foreground transition-transform",
                    open && "rotate-90"
                  )}
                />
              </button>
            </CollapsibleTrigger>
          ) : (
            <span className="w-[22px] shrink-0" />
          )}
          <button
            type="button"
            className="flex-1 text-left min-w-0 flex items-center gap-2"
            onClick={handleSelect}
          >
            <span className="font-mono text-xs text-muted-foreground shrink-0">
              {account.code}
            </span>
            <span className="truncate">{account.name}</span>
          </button>
        </div>
        <CollapsibleContent>
          {(account.children ?? []).map((child) => (
            <AccountTreeRow
              key={child.id}
              account={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onClose={onClose}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface GeneralLedgerRow {
  entry_date: string;
  entry_number: number;
  account_code?: string;
  account_name?: string;
  description: string;
  debit: string;
  credit: string;
  running_balance: string;
}

export default function GeneralLedgerPage() {
  const { tenant } = useTenantContext();
  const [accountsTree, setAccountsTree] = useState<AccountWithChildren[]>([]);
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<GeneralLedgerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  const accountsFlat = flattenAccounts(accountsTree);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    Promise.all([
      api.get<AccountWithChildren[]>("/accounting/accounts", { tenantId }),
      api.get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId }),
    ])
      .then(([accs, perds]) => {
        setAccountsTree(accs);
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

  const handleExportExcel = () => {
    const accountLabel =
      accountsFlat.find((a) => a.id === selectedAccountId)?.name ?? "Cuenta";
    const rows = data.map((row) => ({
      Fecha: row.entry_date,
      Asiento: row.entry_number,
      Descripción: row.description,
      Debe: parseFloat(row.debit) || 0,
      Haber: parseFloat(row.credit) || 0,
      Saldo: parseFloat(row.running_balance) || 0,
    }));
    downloadExcel(
      [{ name: "Libro Mayor", rows }],
      `libro-mayor-${accountLabel.replace(/\s+/g, "-")}-${startDate}-${endDate}.xlsx`
    );
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
              <DropdownMenu open={accountDropdownOpen} onOpenChange={setAccountDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-[280px] justify-between font-normal"
                    disabled={!accountsTree.length}
                  >
                    <span className="truncate">
                      {selectedAccountId
                        ? getAccountLabel(accountsTree, selectedAccountId)
                        : "Seleccionar cuenta"}
                    </span>
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      className="size-3.5 shrink-0 rotate-90 text-muted-foreground"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[280px] max-h-[320px] overflow-y-auto p-1">
                  {accountsTree.map((acc) => (
                    <AccountTreeRow
                      key={acc.id}
                      account={acc}
                      depth={0}
                      selectedId={selectedAccountId}
                      onSelect={setSelectedAccountId}
                      onClose={() => setAccountDropdownOpen(false)}
                    />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
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
          <div className="flex items-center justify-between">
            <CardTitle>Movimientos</CardTitle>
            {hasSearched && data.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                Exportar a Excel
              </Button>
            )}
          </div>
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
                    {data.some((r) => r.account_code != null) && (
                      <th className="text-left py-2 px-3 font-medium">Cuenta</th>
                    )}
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
                      {data.some((r) => r.account_code != null) && (
                        <td className="py-2 px-3 text-muted-foreground">
                          {row.account_code != null ? (
                            <span className="font-mono text-xs">{row.account_code}{row.account_name ? ` — ${row.account_name}` : ""}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
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
