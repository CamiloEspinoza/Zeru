"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ACCOUNT_TYPES: AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
];

export default function ChartOfAccountsPage() {
  const { tenant } = useTenantContext();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create account dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<AccountType | "">("");
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchAccounts = () => {
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
  };

  useEffect(() => {
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const handleCreate = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setCreateError(null);

    if (!newCode.trim() || !newName.trim() || !newType) {
      setCreateError("Todos los campos son obligatorios.");
      return;
    }

    setCreating(true);
    try {
      await api.post(
        "/accounting/accounts",
        { code: newCode.trim(), name: newName.trim(), type: newType },
        { tenantId }
      );
      const data = await api.get<AccountWithChildren[]>(
        "/accounting/accounts",
        { tenantId }
      );
      setAccounts(flattenAccounts(data));
      setCreateOpen(false);
      setNewCode("");
      setNewName("");
      setNewType("");
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Error al crear cuenta"
      );
    } finally {
      setCreating(false);
    }
  };

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
        <Button onClick={() => setCreateOpen(true)}>Nueva Cuenta</Button>
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

      {/* Dialog: Nueva Cuenta */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Cuenta</DialogTitle>
            <DialogDescription>
              Ingresa los datos de la nueva cuenta contable.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-code">Código</Label>
              <Input
                id="account-code"
                placeholder="Ej: 1101"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Nombre</Label>
              <Input
                id="account-name"
                placeholder="Ej: Caja"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={newType}
                onValueChange={(v) => setNewType(v as AccountType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecciona un tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {ACCOUNT_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              {creating ? "Creando..." : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
