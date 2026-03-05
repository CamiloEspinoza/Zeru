"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
import type { FiscalPeriod } from "@zeru/shared";

interface FlatAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

interface AccountTreeNode {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
  children?: AccountTreeNode[];
}

interface EntryLine {
  key: number;
  accountId: string;
  debit: string;
  credit: string;
  description: string;
}

function flattenAccounts(nodes: AccountTreeNode[]): FlatAccount[] {
  const result: FlatAccount[] = [];
  for (const node of nodes) {
    result.push({
      id: node.id,
      code: node.code,
      name: node.name,
      type: node.type,
      isActive: node.isActive,
    });
    if (node.children?.length) {
      result.push(...flattenAccounts(node.children));
    }
  }
  return result;
}

let lineKeyCounter = 2;

export default function NewJournalEntryPage() {
  const router = useRouter();
  const { tenant } = useTenantContext();

  const [accounts, setAccounts] = useState<FlatAccount[]>([]);
  const [fiscalPeriods, setFiscalPeriods] = useState<FiscalPeriod[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [fiscalPeriodId, setFiscalPeriodId] = useState("");
  const [lines, setLines] = useState<EntryLine[]>([
    { key: 0, accountId: "", debit: "", credit: "", description: "" },
    { key: 1, accountId: "", debit: "", credit: "", description: "" },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accountSearch, setAccountSearch] = useState<Record<number, string>>(
    {}
  );

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) {
      setLoadingData(false);
      return;
    }

    Promise.all([
      api.get<AccountTreeNode[]>("/accounting/accounts", { tenantId }),
      api.get<FiscalPeriod[]>("/accounting/fiscal-periods", { tenantId }),
    ])
      .then(([accountsTree, periods]) => {
        const flat = flattenAccounts(accountsTree).filter((a) => a.isActive);
        flat.sort((a, b) => a.code.localeCompare(b.code));
        setAccounts(flat);
        setFiscalPeriods(periods);

        const openPeriod = periods.find((p) => p.status === "OPEN");
        if (openPeriod) setFiscalPeriodId(openPeriod.id);
      })
      .catch((err) => setError(err.message ?? "Error cargando datos"))
      .finally(() => setLoadingData(false));
  }, [tenant?.id]);

  const updateLine = useCallback(
    (key: number, field: keyof EntryLine, value: string) => {
      setLines((prev) =>
        prev.map((l) => (l.key === key ? { ...l, [field]: value } : l))
      );
    },
    []
  );

  const addLine = useCallback(() => {
    setLines((prev) => [
      ...prev,
      {
        key: lineKeyCounter++,
        accountId: "",
        debit: "",
        credit: "",
        description: "",
      },
    ]);
  }, []);

  const removeLine = useCallback(
    (key: number) => {
      if (lines.length <= 2) return;
      setLines((prev) => prev.filter((l) => l.key !== key));
    },
    [lines.length]
  );

  const totalDebit = lines.reduce(
    (sum, l) => sum + (parseFloat(l.debit) || 0),
    0
  );
  const totalCredit = lines.reduce(
    (sum, l) => sum + (parseFloat(l.credit) || 0),
    0
  );
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasValidLines = lines.every(
    (l) =>
      l.accountId &&
      (parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0)
  );
  const canSubmit =
    date && description.trim() && fiscalPeriodId && hasValidLines && isBalanced;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        date,
        description: description.trim(),
        fiscalPeriodId,
        lines: lines.map((l) => ({
          accountId: l.accountId,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          ...(l.description.trim()
            ? { description: l.description.trim() }
            : {}),
        })),
      };

      await api.post("/accounting/journal-entries", payload, { tenantId });
      router.push("/accounting/journal");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al crear el asiento"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Nuevo Asiento Contable</h1>
        <p className="text-muted-foreground">Cargando datos...</p>
      </div>
    );
  }

  const openPeriods = fiscalPeriods.filter((p) => p.status === "OPEN");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Nuevo Asiento Contable</h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/accounting/journal">Cancelar</Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Datos del Asiento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fiscalPeriod">Período Fiscal</Label>
              {openPeriods.length === 0 ? (
                <p className="text-sm text-destructive">
                  No hay períodos fiscales abiertos.
                </p>
              ) : (
                <Select
                  value={fiscalPeriodId}
                  onValueChange={setFiscalPeriodId}
                >
                  <SelectTrigger id="fiscalPeriod">
                    <SelectValue placeholder="Seleccionar período" />
                  </SelectTrigger>
                  <SelectContent>
                    {openPeriods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="description">Descripción / Glosa</Label>
              <Input
                id="description"
                placeholder="Ej: Pago a proveedor"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Líneas Contables</CardTitle>
            <Button variant="outline" size="sm" onClick={addLine}>
              Agregar línea
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium w-[40%]">
                    Cuenta
                  </th>
                  <th className="text-right py-2 px-2 font-medium w-[18%]">
                    Debe
                  </th>
                  <th className="text-right py-2 px-2 font-medium w-[18%]">
                    Haber
                  </th>
                  <th className="text-left py-2 px-2 font-medium w-[20%]">
                    Descripción
                  </th>
                  <th className="w-[4%]" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const search = (
                    accountSearch[line.key] ?? ""
                  ).toLowerCase();
                  const filteredAccounts = search
                    ? accounts.filter(
                        (a) =>
                          a.code.toLowerCase().includes(search) ||
                          a.name.toLowerCase().includes(search)
                      )
                    : accounts;

                  return (
                    <tr key={line.key} className="border-b last:border-0">
                      <td className="py-2 px-2">
                        <div className="relative">
                          <Input
                            placeholder="Buscar cuenta..."
                            value={
                              accountSearch[line.key] ??
                              (line.accountId
                                ? (() => {
                                    const acc = accounts.find(
                                      (a) => a.id === line.accountId
                                    );
                                    return acc
                                      ? `${acc.code} — ${acc.name}`
                                      : "";
                                  })()
                                : "")
                            }
                            onChange={(e) => {
                              setAccountSearch((prev) => ({
                                ...prev,
                                [line.key]: e.target.value,
                              }));
                              if (line.accountId) {
                                updateLine(line.key, "accountId", "");
                              }
                            }}
                            onFocus={() => {
                              if (line.accountId) {
                                setAccountSearch((prev) => ({
                                  ...prev,
                                  [line.key]: "",
                                }));
                              }
                            }}
                            onBlur={() => {
                              // Delay to allow click on option
                              setTimeout(() => {
                                if (!line.accountId) {
                                  setAccountSearch((prev) => {
                                    const next = { ...prev };
                                    delete next[line.key];
                                    return next;
                                  });
                                } else {
                                  setAccountSearch((prev) => {
                                    const next = { ...prev };
                                    delete next[line.key];
                                    return next;
                                  });
                                }
                              }, 200);
                            }}
                            className="text-xs"
                          />
                          {accountSearch[line.key] !== undefined &&
                            !line.accountId && (
                              <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                                {filteredAccounts.length === 0 ? (
                                  <div className="px-3 py-2 text-xs text-muted-foreground">
                                    Sin resultados
                                  </div>
                                ) : (
                                  filteredAccounts.slice(0, 50).map((acc) => (
                                    <button
                                      key={acc.id}
                                      type="button"
                                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent cursor-pointer"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        updateLine(
                                          line.key,
                                          "accountId",
                                          acc.id
                                        );
                                        setAccountSearch((prev) => {
                                          const next = { ...prev };
                                          delete next[line.key];
                                          return next;
                                        });
                                      }}
                                    >
                                      <span className="font-mono">
                                        {acc.code}
                                      </span>{" "}
                                      — {acc.name}
                                    </button>
                                  ))
                                )}
                              </div>
                            )}
                        </div>
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={line.debit}
                          onChange={(e) =>
                            updateLine(line.key, "debit", e.target.value)
                          }
                          className="text-right text-xs"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="0"
                          value={line.credit}
                          onChange={(e) =>
                            updateLine(line.key, "credit", e.target.value)
                          }
                          className="text-right text-xs"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <Input
                          placeholder="Opcional"
                          value={line.description}
                          onChange={(e) =>
                            updateLine(line.key, "description", e.target.value)
                          }
                          className="text-xs"
                        />
                      </td>
                      <td className="py-2 px-2">
                        {lines.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeLine(line.key)}
                          >
                            ×
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2 px-2">Total</td>
                  <td className="py-2 px-2 text-right">
                    {formatCLP(totalDebit)}
                  </td>
                  <td className="py-2 px-2 text-right">
                    {formatCLP(totalCredit)}
                  </td>
                  <td colSpan={2} className="py-2 px-2">
                    {!isBalanced && totalDebit + totalCredit > 0 && (
                      <span className="text-destructive text-xs">
                        Diferencia: {formatCLP(Math.abs(totalDebit - totalCredit))}
                      </span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href="/accounting/journal">Cancelar</Link>
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Guardando..." : "Crear Asiento"}
        </Button>
      </div>
    </div>
  );
}
