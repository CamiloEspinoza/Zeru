"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { downloadExcel } from "@/lib/export-excel";

const MONTH_ABBR: Record<string, string> = {
  Enero: "Ene", Febrero: "Feb", Marzo: "Mar", Abril: "Abr", Mayo: "May",
  Junio: "Jun", Julio: "Jul", Agosto: "Ago", Septiembre: "Sep",
  Octubre: "Oct", Noviembre: "Nov", Diciembre: "Dic",
};

/** Abrevia el nombre del mes y quita el año (el año ya está en el selector). */
function monthColumnLabel(name: string): string {
  let out = name;
  for (const [full, abbr] of Object.entries(MONTH_ABBR)) {
    out = out.replace(new RegExp(full, "gi"), abbr);
  }
  return out.replace(/\s*(?:-\s*)?\d{4}$/, "").trim() || out;
}

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

// ─── By-month (one column per period) ──────────────────────────────

interface RowByMonth {
  account_id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  balances: string[];
}

interface AccountNodeMulti {
  account_id: string;
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  parent_id: string | null;
  balances: number[];
  children: AccountNodeMulti[];
}

function buildTreeMulti(rows: RowByMonth[], periodCount: number): AccountNodeMulti[] {
  const map = new Map<string, AccountNodeMulti>();

  for (const row of rows) {
    const balances = row.balances.map((b) => parseFloat(b));
    while (balances.length < periodCount) balances.push(0);
    map.set(row.account_id, {
      ...row,
      type: row.type as "REVENUE" | "EXPENSE",
      balances,
      children: [],
    });
  }

  const roots: AccountNodeMulti[] = [];

  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sumChildren(node: AccountNodeMulti): number[] {
    if (node.children.length === 0) return node.balances;
    const n = node.balances.length;
    const sum = new Array(n).fill(0);
    for (const c of node.children) {
      const childSums = sumChildren(c);
      for (let i = 0; i < n; i++) sum[i] += childSums[i];
    }
    node.balances = sum;
    return sum;
  }

  roots.forEach(sumChildren);
  return roots;
}

function splitByTypeMulti(roots: AccountNodeMulti[]) {
  const revenue = roots.filter((n) => n.type === "REVENUE");
  const expense = roots.filter((n) => n.type === "EXPENSE");
  return { revenue, expense };
}

// ─── Entry rows subcomponent ──────────────────────────────────────

interface EntrySubtableProps {
  accountId: string;
  fiscalPeriodId: string;
  tenantId: string;
}

function EntrySubtable({ accountId, fiscalPeriodId, tenantId }: EntrySubtableProps) {
  const [rows, setRows] = useState<IncomeStatementEntryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<IncomeStatementEntryRow[]>(
        `/accounting/reports/income-statement/account-entries?accountId=${accountId}&fiscalPeriodId=${fiscalPeriodId}`,
        { tenantId }
      )
      .then(setRows)
      .finally(() => setLoading(false));
  }, [accountId, fiscalPeriodId, tenantId]);

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
  fiscalPeriodId: string;
  tenantId: string;
}

function AccountRow({ node, depth, fiscalPeriodId, tenantId }: AccountRowProps) {
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
                  fiscalPeriodId={fiscalPeriodId}
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
                fiscalPeriodId={fiscalPeriodId}
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
  fiscalPeriodId: string;
  tenantId: string;
  defaultOpen?: boolean;
}

function Section({ label, nodes, total, fiscalPeriodId, tenantId, defaultOpen = false }: SectionProps) {
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
            fiscalPeriodId={fiscalPeriodId}
            tenantId={tenantId}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// ─── Process step (for progress count) ──────────────────────────────

interface ProcessStepWithCompletion {
  id: string;
  name: string;
  completion?: { status: string } | null;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ─── Main widget ──────────────────────────────────────────────────

export function IncomeStatement() {
  const { tenant } = useTenantContext();
  const tenantId = tenant?.id ?? (typeof window !== "undefined" ? localStorage.getItem("tenant_id") ?? "" : "");

  const [monthlyYear, setMonthlyYear] = useState(CURRENT_YEAR);
  const [monthlyData, setMonthlyData] = useState<{
    periods: Array<{ id: string; name: string }>;
    rows: RowByMonth[];
  } | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyError, setMonthlyError] = useState<string | null>(null);

  const loadMonthly = useCallback(() => {
    if (!tenantId) return;
    setMonthlyLoading(true);
    setMonthlyError(null);
    api
      .get<{ periods: Array<{ id: string; name: string }>; rows: RowByMonth[] }>(
        `/accounting/reports/income-statement/by-month?year=${monthlyYear}`,
        { tenantId }
      )
      .then(setMonthlyData)
      .catch((err) => {
        setMonthlyData(null);
        setMonthlyError(err.message ?? "Error al cargar por mes");
      })
      .finally(() => setMonthlyLoading(false));
  }, [tenantId, monthlyYear]);

  useEffect(() => {
    loadMonthly();
  }, [loadMonthly]);

  const monthlyTree = monthlyData
    ? buildTreeMulti(monthlyData.rows, monthlyData.periods.length)
    : [];
  const { revenue: revenueMulti, expense: expenseMulti } = splitByTypeMulti(monthlyTree);
  const periodCount = monthlyData?.periods.length ?? 0;
  const totalRevenueByMonth =
    periodCount > 0
      ? (idx: number) =>
          revenueMulti.reduce((s, n) => s + (n.balances[idx] ?? 0), 0)
      : () => 0;
  const totalExpenseByMonth =
    periodCount > 0
      ? (idx: number) =>
          expenseMulti.reduce((s, n) => s + (n.balances[idx] ?? 0), 0)
      : () => 0;

  function renderMonthlyRow(
    node: AccountNodeMulti,
    depth: number,
    periodCount: number
  ): React.ReactNode {
    const indent = depth * 16;
    const total = node.balances.reduce((a, b) => a + b, 0);
    const valueColor =
      total >= 0 ? "text-foreground" : "text-destructive";
    return (
      <tr key={node.account_id} className="border-b last:border-0 hover:bg-muted/30">
        <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground" style={{ paddingLeft: `${12 + indent}px` }}>
          {node.code}
        </td>
        <td className="py-1.5 px-2 text-sm">{node.name}</td>
        {node.balances.slice(0, periodCount).map((val, i) => (
          <td key={i} className={`py-1.5 px-2 text-right text-xs tabular-nums ${valueColor}`}>
            {formatCLP(val)}
          </td>
        ))}
        <td className={`py-1.5 px-2 text-right text-xs font-medium tabular-nums ${valueColor}`}>
          {formatCLP(total)}
        </td>
      </tr>
    );
  }

  function renderMonthlySection(
    label: string,
    nodes: AccountNodeMulti[],
    periodCount: number,
    getTotalByIndex: (i: number) => number
  ) {
    const totalAll = nodes.reduce(
      (s, n) => s + n.balances.reduce((a, b) => a + b, 0),
      0
    );
    return (
      <>
        <tr className="border-b bg-muted/30">
          <td colSpan={2} className="py-2 px-2 font-semibold text-sm">
            {label}
          </td>
          {monthlyData?.periods.map((_, i) => (
            <td key={i} className="py-2 px-2 text-right text-xs font-semibold tabular-nums">
              {formatCLP(getTotalByIndex(i))}
            </td>
          ))}
          <td className="py-2 px-2 text-right text-sm font-bold tabular-nums">
            {formatCLP(totalAll)}
          </td>
        </tr>
        {nodes.map((node) => (
          <Fragment key={node.account_id}>
            {renderMonthlyRow(node, 0, periodCount)}
            {node.children.map((child) => (
              <Fragment key={child.account_id}>
                {renderMonthlyRow(child, 1, periodCount)}
                {child.children.map((grand) =>
                  renderMonthlyRow(grand, 2, periodCount)
                )}
              </Fragment>
            ))}
          </Fragment>
        ))}
      </>
    );
  }

  function buildExcelRows(): Record<string, string | number>[] {
    if (!monthlyData || monthlyData.periods.length === 0) return [];
    const rows: Record<string, string | number>[] = [];

    const toRow = (code: string, name: string, values: number[]) => {
      const row: Record<string, string | number> = { Código: code, Cuenta: name };
      monthlyData.periods.forEach((_, i) => {
        row[monthColumnLabel(monthlyData.periods[i].name)] = values[i] ?? 0;
      });
      row["Total"] = values.reduce((a, b) => a + b, 0);
      return row;
    };

    rows.push(toRow("", "Ingresos", monthlyData.periods.map((_, i) => totalRevenueByMonth(i))));
    function addNodes(nodes: AccountNodeMulti[]) {
      for (const node of nodes) {
        rows.push(toRow(node.code, node.name, node.balances.slice(0, monthlyData!.periods.length)));
        if (node.children.length) addNodes(node.children);
      }
    }
    addNodes(revenueMulti);

    rows.push(toRow("", "Gastos", monthlyData.periods.map((_, i) => totalExpenseByMonth(i))));
    addNodes(expenseMulti);

    const resultByMonth = monthlyData.periods.map((_, i) => totalRevenueByMonth(i) - totalExpenseByMonth(i));
    rows.push(toRow("", "Resultado", resultByMonth));
    return rows;
  }

  const handleExportExcel = () => {
    const rows = buildExcelRows();
    if (rows.length === 0) return;
    downloadExcel(
      [{ name: "Estado de Resultados", rows }],
      `estado-de-resultados-${monthlyYear}.xlsx`
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base flex-wrap">
            <span>Estado de Resultados</span>
            <Select
              value={String(monthlyYear)}
              onValueChange={(v) => setMonthlyYear(Number(v))}
            >
              <SelectTrigger size="sm" className="w-[100px] font-normal">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {monthlyData && monthlyData.periods.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                Exportar a Excel
              </Button>
            )}
          </CardTitle>
          {monthlyData && !monthlyLoading && !monthlyError && (
            <span className="text-xs text-muted-foreground">
              {monthlyData.periods.length} períodos
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {monthlyError && (
          <p className="text-sm text-destructive py-2">{monthlyError}</p>
        )}
        {monthlyLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
            <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
            Cargando...
          </div>
        ) : monthlyData && monthlyData.periods.length > 0 ? (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium w-20">Código</th>
                  <th className="text-left py-2 px-2 font-medium min-w-[140px]">Cuenta</th>
                  {monthlyData.periods.map((p) => (
                    <th key={p.id} className="text-right py-2 px-2 font-medium text-muted-foreground text-xs">
                      {monthColumnLabel(p.name)}
                    </th>
                  ))}
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {renderMonthlySection(
                  "Ingresos",
                  revenueMulti,
                  monthlyData.periods.length,
                  totalRevenueByMonth
                )}
                {renderMonthlySection(
                  "Gastos",
                  expenseMulti,
                  monthlyData.periods.length,
                  totalExpenseByMonth
                )}
                <tr className="border-t-2 bg-muted/50 font-bold">
                  <td colSpan={2} className="py-2 px-2">
                    Resultado
                  </td>
                  {monthlyData.periods.map((_, i) => {
                    const res = totalRevenueByMonth(i) - totalExpenseByMonth(i);
                    return (
                      <td
                        key={i}
                        className={`py-2 px-2 text-right tabular-nums ${res >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                      >
                        {res >= 0 ? "+" : ""}
                        {formatCLP(res)}
                      </td>
                    );
                  })}
                  <td
                    className={`py-2 px-2 text-right tabular-nums ${revenueMulti.reduce((s, n) => s + n.balances.reduce((a, b) => a + b, 0), 0) - expenseMulti.reduce((s, n) => s + n.balances.reduce((a, b) => a + b, 0), 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}
                  >
                    {(() => {
                      const total =
                        revenueMulti.reduce((s, n) => s + n.balances.reduce((a, b) => a + b, 0), 0) -
                        expenseMulti.reduce((s, n) => s + n.balances.reduce((a, b) => a + b, 0), 0);
                      return (total >= 0 ? "+" : "") + formatCLP(total);
                    })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : monthlyData?.periods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay períodos fiscales en {monthlyYear}. Crea períodos mensuales en Contabilidad.
          </p>
        ) : null}

      </CardContent>
    </Card>
  );
}
