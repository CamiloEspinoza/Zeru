"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import type { Account, AccountType } from "@zeru/shared";

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

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  ASSET: "Activo",
  LIABILITY: "Pasivo",
  EQUITY: "Patrimonio",
  REVENUE: "Ingreso",
  EXPENSE: "Gasto",
};

export default function ChartOfAccountsPage() {
  const { tenant } = useTenantContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) {
      setLoading(false);
      return;
    }

    api
      .get<AccountWithChildren[]>("/accounting/accounts", { tenantId })
      .then((data) => setAccounts(flattenAccounts(data)))
      .catch((err) => setError(err.message ?? "Error al cargar cuentas"))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
        <Button asChild>
          <Link href="/accounting/chart-of-accounts/new">Nueva Cuenta</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Código</th>
                  <th className="text-left py-2 px-3 font-medium">Nombre</th>
                  <th className="text-left py-2 px-3 font-medium">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b last:border-0">
                    <td className="py-2 px-3 font-mono">{account.code}</td>
                    <td className="py-2 px-3">{account.name}</td>
                    <td className="py-2 px-3">
                      <Badge variant="secondary">
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={account.isActive ? "default" : "outline"}>
                        {account.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
