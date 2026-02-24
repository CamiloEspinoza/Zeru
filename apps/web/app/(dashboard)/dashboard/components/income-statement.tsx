"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import type { IncomeStatementRow, IncomeStatementEntryRow } from "@zeru/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Loading02Icon,
} from "@hugeicons/core-free-icons";

// ─── Tree builder ────────────────────────────────────────────────

interface AccountNode {
  account_id: string;
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  parent_id: string | null;
  balance: number;
  children: AccountNode[];
}

function buildTree(rows: IncomeStatementRow[]): AccountNode[] {
  const map = new Map<string, AccountNode>();

  for (const row of rows) {
    map.set(row.account_id, {
      ...row,
      balance: parseFloat(row.balance),
      children: [],
    });
  }

  const roots: AccountNode[] = [];

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // For parent nodes without direct entries, sum children
  function sumChildren(node: AccountNode): number {
    if (node.children.length === 0) return node.balance;
    const sum = node.children.reduce((acc, c) => acc + sumChildren(c), 0);
    node.balance = sum;
    return sum;
  }

  roots.forEach(sumChildren);
  return roots;
}

function splitByType(roots: AccountNode[]) {
  const revenue = roots.filter((n) => n.type === "REVENUE");
  const expense = roots.filter((n) => n.type === "EXPENSE");
  return { revenue, expense };
}

// ─── Entry rows subcomponent ──────────────────────────────────────

interface EntrySubtableProps {
  accountId: string;
  year: number;
  tenantId: string;
}

function EntrySubtable({ accountId, year, tenantId }: EntrySubtableProps) {
  const [rows, setRows] = useState<IncomeStatementEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<IncomeStatementEntryRow[]>(
        `/accounting/reports/income-statement/account-entries?accountId=${accountId}&year=${year}`,
        { tenantId }
      )
      .then(setRows)
      .finally(() => setLoading(false));
  }, [accountId, year, tenantId]);

  if (loading)
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={Loading02Icon} className="size-3 animate-spin" />
        Cargando movimientos...
      </div>
    );

  if (rows.length === 0)
    return (
      <p className="px-3 py-2 text-xs text-muted-foreground">
        Sin movimientos contabilizados.
      </p>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-left py-1.5 px-3 font-medium">Fecha</th>
            <th className="text-left py-1.5 px-3 font-medium">Asiento</th>
            <th className="text-left py-1.5 px-3 font-medium">Descripción</th>
            <th className="text-right py-1.5 px-3 font-medium">Debe</th>
            <th className="text-right py-1.5 px-3 font-medium">Haber</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-3">
                {new Date(row.entry_date).toLocaleDateString("es-CL")}
              </td>
              <td className="py-1.5 px-3">
                <Link
                  href={`/accounting/journal/${row.journal_entry_id}`}
                  className="text-primary underline-offset-2 hover:underline"
                >
                  #{row.entry_number}
                </Link>
              </td>
              <td className="py-1.5 px-3 max-w-[200px] truncate">
                {row.description}
              </td>
              <td className="py-1.5 px-3 text-right tabular-nums">
                {parseFloat(row.debit) > 0
                  ? formatCLP(parseFloat(row.debit))
                  : "—"}
              </td>
              <td className="py-1.5 px-3 text-right tabular-nums">
                {parseFloat(row.credit) > 0
                  ? formatCLP(parseFloat(row.credit))
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Account tree node ────────────────────────────────────────────

interface AccountRowProps {
  node: AccountNode;
  depth: number;
  year: number;
  tenantId: string;
}

function AccountRow({ node, depth, year, tenantId }: AccountRowProps) {
  const [open, setOpen] = useState(false);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const isLeaf = node.children.length === 0;
  const indent = depth * 16;

  const valueColor =
    node.balance >= 0
      ? "text-foreground"
      : "text-destructive";

  return (
    <>
      {isLeaf ? (
        <>
          <Collapsible open={entriesOpen} onOpenChange={setEntriesOpen}>
            <CollapsibleTrigger asChild>
              <div
                className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/40 cursor-pointer group text-sm"
                style={{ paddingLeft: `${indent + 12}px` }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    className={`size-3 shrink-0 text-muted-foreground transition-transform duration-150 ${entriesOpen ? "rotate-90" : ""}`}
                  />
                  <span className="font-mono text-xs text-muted-foreground shrink-0">
                    {node.code}
                  </span>
                  <span className="truncate">{node.name}</span>
                </div>
                <span className={`tabular-nums text-xs font-medium shrink-0 ml-4 ${valueColor}`}>
                  {formatCLP(node.balance)}
                </span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="bg-muted/20 border-l-2 border-border ml-6 my-0.5 rounded-sm">
                <EntrySubtable
                  accountId={node.account_id}
                  year={year}
                  tenantId={tenantId}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      ) : (
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <div
              className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/40 cursor-pointer text-sm font-medium"
              style={{ paddingLeft: `${indent + 12}px` }}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <HugeiconsIcon
                  icon={ArrowRight01Icon}
                  className={`size-3 shrink-0 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                />
                <span className="font-mono text-xs text-muted-foreground shrink-0">
                  {node.code}
                </span>
                <span className="truncate">{node.name}</span>
              </div>
              <span className={`tabular-nums text-xs font-semibold shrink-0 ml-4 ${valueColor}`}>
                {formatCLP(node.balance)}
              </span>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {node.children.map((child) => (
              <AccountRow
                key={child.account_id}
                node={child}
                depth={depth + 1}
                year={year}
                tenantId={tenantId}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </>
  );
}

// ─── Section (Ingresos / Gastos) ──────────────────────────────────

interface SectionProps {
  label: string;
  nodes: AccountNode[];
  total: number;
  year: number;
  tenantId: string;
  defaultOpen?: boolean;
}

function Section({ label, nodes, total, year, tenantId, defaultOpen = false }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-muted/30 cursor-pointer group">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ArrowRight01Icon}
              className={`size-4 text-muted-foreground transition-transform duration-150 ${open ? "rotate-90" : ""}`}
            />
            <span className="font-semibold text-sm">{label}</span>
          </div>
          <span className="text-sm font-bold tabular-nums">
            {formatCLP(total)}
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-2">
        {nodes.map((node) => (
          <AccountRow
            key={node.account_id}
            node={node}
            depth={0}
            year={year}
            tenantId={tenantId}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Main widget ──────────────────────────────────────────────────

export function IncomeStatement() {
  const { tenant } = useTenantContext();
  const year = new Date().getFullYear();
  const [nodes, setNodes] = useState<AccountNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;

    setLoading(true);
    setError(null);
    api
      .get<IncomeStatementRow[]>(
        `/accounting/reports/income-statement?year=${year}`,
        { tenantId }
      )
      .then((rows) => setNodes(buildTree(rows)))
      .catch((err) => setError(err.message ?? "Error al cargar estado de resultados"))
      .finally(() => setLoading(false));
  }, [tenant?.id, year]);

  useEffect(() => {
    load();
  }, [load]);

  const { revenue, expense } = splitByType(nodes);
  const totalRevenue = revenue.reduce((s, n) => s + n.balance, 0);
  const totalExpense = expense.reduce((s, n) => s + n.balance, 0);
  const resultado = totalRevenue - totalExpense;
  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenant_id") ?? "" : "");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <span>Estado de Resultados {year}</span>
          {!loading && !error && (
            <span
              className={`text-sm font-bold tabular-nums ${resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
            >
              {resultado >= 0 ? "+" : ""}
              {formatCLP(resultado)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {error && (
          <p className="text-sm text-destructive py-2">{error}</p>
        )}
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
            <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
            Cargando...
          </div>
        ) : nodes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay asientos contabilizados en {year}.
          </p>
        ) : (
          <div className="space-y-0.5">
            <Section
              label="Ingresos"
              nodes={revenue}
              total={totalRevenue}
              year={year}
              tenantId={tenantId}
            />
            <Section
              label="Gastos"
              nodes={expense}
              total={totalExpense}
              year={year}
              tenantId={tenantId}
            />
            <div className="flex items-center justify-between px-3 py-2 mt-1 rounded-md bg-muted/50 border">
              <span className="font-bold text-sm">Resultado</span>
              <span
                className={`text-sm font-bold tabular-nums ${resultado >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
              >
                {resultado >= 0 ? "+" : ""}
                {formatCLP(resultado)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
