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
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import type {
  IncomeStatementRow,
  IncomeStatementEntryRow,
  AccountIFRSSection,
} from "@zeru/shared";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Loading02Icon } from "@hugeicons/core-free-icons";
import { downloadExcel } from "@/lib/export-excel";
import { cn } from "@/lib/utils";

// ─── IAS 1 section config ────────────────────────────────────────

interface SectionDef {
  key: AccountIFRSSection;
  label: string;
  /** P&L sign: revenues add, costs subtract from gross/operating/etc. */
  sign: 1 | -1;
}

// Ordered sections according to IAS 1 (function method)
const IAS1_SECTIONS: SectionDef[] = [
  { key: "REVENUE",            label: "Ingresos de Actividades Ordinarias", sign: 1 },
  { key: "OTHER_INCOME",       label: "Otros Ingresos",                     sign: 1 },
  { key: "COST_OF_SALES",      label: "Costo de Ventas",                    sign: -1 },
  { key: "OPERATING_EXPENSE",  label: "Gastos de Administración y Ventas",  sign: -1 },
  { key: "FINANCE_INCOME",     label: "Ingresos Financieros",               sign: 1 },
  { key: "FINANCE_COST",       label: "Gastos Financieros",                 sign: -1 },
  { key: "TAX_EXPENSE",        label: "Gasto por Impuesto a las Ganancias", sign: -1 },
];

// Subtotal rows inserted after specific sections
const SUBTOTAL_AFTER: Partial<Record<AccountIFRSSection, string>> = {
  COST_OF_SALES:     "Resultado Bruto",
  OPERATING_EXPENSE: "Resultado Operativo",
  FINANCE_COST:      "Resultado antes de Impuesto",
};

// ─── Month abbreviations ─────────────────────────────────────────

const MONTH_ABBR: Record<string, string> = {
  Enero: "Ene", Febrero: "Feb", Marzo: "Mar", Abril: "Abr", Mayo: "May",
  Junio: "Jun", Julio: "Jul", Agosto: "Ago", Septiembre: "Sep",
  Octubre: "Oct", Noviembre: "Nov", Diciembre: "Dic",
};

function monthColumnLabel(name: string): string {
  let out = name;
  for (const [full, abbr] of Object.entries(MONTH_ABBR)) {
    out = out.replace(new RegExp(full, "gi"), abbr);
  }
  return out.replace(/\s*(?:-\s*)?\d{4}$/, "").trim() || out;
}

// ─── Data types ───────────────────────────────────────────────────

interface RowByMonth {
  account_id: string;
  code: string;
  name: string;
  type: string;
  parent_id: string | null;
  ifrs_section: AccountIFRSSection;
  balances: string[];
}

interface AccountNodeMulti {
  account_id: string;
  code: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
  parent_id: string | null;
  ifrs_section: AccountIFRSSection;
  balances: number[];
  children: AccountNodeMulti[];
}

// ─── Tree builder ─────────────────────────────────────────────────

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
      const cs = sumChildren(c);
      for (let i = 0; i < n; i++) sum[i] += cs[i];
    }
    node.balances = sum;
    return sum;
  }
  roots.forEach(sumChildren);
  return roots;
}

/** Group tree nodes by their ifrs_section */
function groupBySection(
  nodes: AccountNodeMulti[]
): Map<AccountIFRSSection, AccountNodeMulti[]> {
  const map = new Map<AccountIFRSSection, AccountNodeMulti[]>();
  for (const node of nodes) {
    const key = node.ifrs_section || "";
    if (!map.has(key as AccountIFRSSection)) map.set(key as AccountIFRSSection, []);
    map.get(key as AccountIFRSSection)!.push(node);
    // Flatten children that belong to a different section up to root level
    // (children already inherit section from the query — they stay nested)
  }
  return map;
}

function sectionTotal(nodes: AccountNodeMulti[], periodIdx: number): number {
  return nodes.reduce((s, n) => s + (n.balances[periodIdx] ?? 0), 0);
}

function sectionTotalAll(nodes: AccountNodeMulti[]): number {
  return nodes.reduce((s, n) => s + n.balances.reduce((a, b) => a + b, 0), 0);
}

// ─── Entry subtable ───────────────────────────────────────────────

function EntrySubtable({
  accountId,
  fiscalPeriodId,
  tenantId,
}: {
  accountId: string;
  fiscalPeriodId: string;
  tenantId: string;
}) {
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
        Cargando...
      </div>
    );
  if (rows.length === 0)
    return <p className="px-3 py-2 text-xs text-muted-foreground">Sin movimientos.</p>;

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
              <td className="py-1.5 px-3 max-w-[200px] truncate">{row.description}</td>
              <td className="py-1.5 px-3 text-right tabular-nums">
                {parseFloat(row.debit) > 0 ? formatCLP(parseFloat(row.debit)) : "—"}
              </td>
              <td className="py-1.5 px-3 text-right tabular-nums">
                {parseFloat(row.credit) > 0 ? formatCLP(parseFloat(row.credit)) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Year options ─────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

// ─── Main component ───────────────────────────────────────────────

export function IncomeStatement() {
  const { tenant } = useTenantContext();
  const tenantId =
    tenant?.id ??
    (typeof window !== "undefined" ? localStorage.getItem("tenant_id") ?? "" : "");

  const [year, setYear] = useState(CURRENT_YEAR);
  const [data, setData] = useState<{
    periods: Array<{ id: string; name: string }>;
    rows: RowByMonth[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    api
      .get<{ periods: Array<{ id: string; name: string }>; rows: RowByMonth[] }>(
        `/accounting/reports/income-statement/by-month?year=${year}`,
        { tenantId }
      )
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err.message ?? "Error al cargar");
      })
      .finally(() => setLoading(false));
  }, [tenantId, year]);

  useEffect(() => { load(); }, [load]);

  const periodCount = data?.periods.length ?? 0;
  const tree = data ? buildTreeMulti(data.rows, periodCount) : [];
  const bySection = groupBySection(tree);

  // For "ungrouped" accounts (ifrs_section=""), show them at the bottom
  const fallbackRevenue = (bySection.get("" as AccountIFRSSection) ?? []).filter(
    (n) => n.type === "REVENUE"
  );
  const fallbackExpense = (bySection.get("" as AccountIFRSSection) ?? []).filter(
    (n) => n.type === "EXPENSE"
  );

  // ── Subtotal accumulator ──
  // We track a running P&L total per period column.
  // Each section contributes with its sign.
  function computeRunningTotals(upToSectionKey: AccountIFRSSection): number[] {
    const totals = new Array(Math.max(periodCount, 1)).fill(0);
    for (const sec of IAS1_SECTIONS) {
      const nodes = bySection.get(sec.key) ?? [];
      for (let i = 0; i < periodCount; i++) {
        totals[i] += sec.sign * sectionTotal(nodes, i);
      }
      if (sec.key === upToSectionKey) break;
    }
    return totals;
  }

  function computeRunningTotal(upToSectionKey: AccountIFRSSection): number {
    return computeRunningTotals(upToSectionKey).reduce((a, b) => a + b, 0);
  }

  // ── Excel export ──
  function buildExcelRows(): Record<string, string | number>[] {
    if (!data || periodCount === 0) return [];
    const rows: Record<string, string | number>[] = [];
    const cols = data.periods.map((p) => monthColumnLabel(p.name));

    const toRow = (code: string, name: string, values: number[]) => {
      const r: Record<string, string | number> = { Código: code, Cuenta: name };
      cols.forEach((c, i) => { r[c] = values[i] ?? 0; });
      r["Total"] = values.reduce((a, b) => a + b, 0);
      return r;
    };

    for (const sec of IAS1_SECTIONS) {
      const nodes = bySection.get(sec.key) ?? [];
      if (nodes.length === 0) continue;
      rows.push(toRow("", IAS1_SECTIONS.find((s) => s.key === sec.key)!.label,
        data.periods.map((_, i) => sectionTotal(nodes, i))));
      function addNodes(ns: AccountNodeMulti[]) {
        for (const n of ns) {
          rows.push(toRow(n.code, n.name, n.balances.slice(0, periodCount)));
          if (n.children.length) addNodes(n.children);
        }
      }
      addNodes(nodes);

      if (SUBTOTAL_AFTER[sec.key]) {
        const running = computeRunningTotals(sec.key);
        rows.push(toRow("", SUBTOTAL_AFTER[sec.key]!, running));
      }
    }

    // Resultado del período
    const finalTotals = computeRunningTotals("TAX_EXPENSE");
    rows.push(toRow("", "Resultado del Período", finalTotals));
    return rows;
  }

  const handleExport = () => {
    const rows = buildExcelRows();
    if (rows.length === 0) return;
    downloadExcel(
      [{ name: "Estado de Resultados", rows }],
      `estado-de-resultados-${year}.xlsx`
    );
  };

  // ── Render a section's account rows ──
  function renderAccountRows(
    nodes: AccountNodeMulti[],
    depth = 0
  ): React.ReactNode {
    return nodes.map((node) => {
      const indent = depth * 16;
      const total = node.balances.reduce((a, b) => a + b, 0);
      const negative = total < 0;
      return (
        <Fragment key={node.account_id}>
          <tr className="border-b last:border-0 hover:bg-muted/30">
            <td
              className="py-1.5 px-2 font-mono text-xs text-muted-foreground"
              style={{ paddingLeft: `${12 + indent}px` }}
            >
              {node.code}
            </td>
            <td className="py-1.5 px-2 text-sm">{node.name}</td>
            {node.balances.slice(0, periodCount).map((val, i) => (
              <td
                key={i}
                className={cn(
                  "py-1.5 px-2 text-right text-xs tabular-nums",
                  val < 0 ? "text-destructive" : "text-foreground"
                )}
              >
                {formatCLP(val)}
              </td>
            ))}
            <td
              className={cn(
                "py-1.5 px-2 text-right text-xs font-medium tabular-nums",
                negative ? "text-destructive" : "text-foreground"
              )}
            >
              {formatCLP(total)}
            </td>
          </tr>
          {node.children.length > 0 && renderAccountRows(node.children, depth + 1)}
        </Fragment>
      );
    });
  }

  // ── Render a section header row ──
  function renderSectionHeader(sec: SectionDef, nodes: AccountNodeMulti[]) {
    const totalAll = sectionTotalAll(nodes);
    return (
      <tr className="border-b bg-muted/30" key={`hdr-${sec.key}`}>
        <td colSpan={2} className="py-2 px-2 font-semibold text-sm">
          {sec.label}
        </td>
        {data!.periods.map((_, i) => (
          <td key={i} className="py-2 px-2 text-right text-xs font-semibold tabular-nums">
            {formatCLP(sectionTotal(nodes, i))}
          </td>
        ))}
        <td className="py-2 px-2 text-right text-sm font-bold tabular-nums">
          {formatCLP(totalAll)}
        </td>
      </tr>
    );
  }

  // ── Render a subtotal row (e.g. Resultado Bruto) ──
  function renderSubtotal(label: string, upToSection: AccountIFRSSection) {
    const running = computeRunningTotals(upToSection);
    const total = running.reduce((a, b) => a + b, 0);
    const negative = total < 0;
    return (
      <tr
        className="border-b border-t bg-muted/50 font-semibold"
        key={`sub-${upToSection}`}
      >
        <td colSpan={2} className="py-2 px-2 text-sm italic text-muted-foreground">
          {label}
        </td>
        {running.map((v, i) => (
          <td
            key={i}
            className={cn(
              "py-2 px-2 text-right tabular-nums text-xs",
              v < 0 ? "text-destructive" : "text-foreground"
            )}
          >
            {v >= 0 ? "+" : ""}{formatCLP(v)}
          </td>
        ))}
        <td
          className={cn(
            "py-2 px-2 text-right tabular-nums text-sm font-semibold",
            negative ? "text-destructive" : "text-foreground"
          )}
        >
          {total >= 0 ? "+" : ""}{formatCLP(total)}
        </td>
      </tr>
    );
  }

  const hasSections = IAS1_SECTIONS.some(
    (s) => (bySection.get(s.key) ?? []).length > 0
  );
  const hasFallback = fallbackRevenue.length > 0 || fallbackExpense.length > 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base flex-wrap">
            <span>Estado de Resultados</span>
            <span className="text-xs font-normal text-muted-foreground">
              IAS 1 — Método de función
            </span>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
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
            {data && periodCount > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                Exportar a Excel
              </Button>
            )}
          </CardTitle>
          {data && !loading && !error && (
            <span className="text-xs text-muted-foreground">
              {periodCount} período{periodCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        {error && <p className="text-sm text-destructive py-2">{error}</p>}
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center">
            <HugeiconsIcon icon={Loading02Icon} className="size-4 animate-spin" />
            Cargando...
          </div>
        ) : data && periodCount > 0 ? (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium w-20">Código</th>
                  <th className="text-left py-2 px-2 font-medium min-w-[160px]">Cuenta</th>
                  {data.periods.map((p) => (
                    <th
                      key={p.id}
                      className="text-right py-2 px-2 font-medium text-muted-foreground text-xs"
                    >
                      {monthColumnLabel(p.name)}
                    </th>
                  ))}
                  <th className="text-right py-2 px-2 font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {/* IAS 1 ordered sections */}
                {IAS1_SECTIONS.map((sec) => {
                  const nodes = bySection.get(sec.key) ?? [];
                  if (nodes.length === 0) return null;
                  return (
                    <Fragment key={sec.key}>
                      {renderSectionHeader(sec, nodes)}
                      {renderAccountRows(nodes)}
                      {SUBTOTAL_AFTER[sec.key] &&
                        renderSubtotal(SUBTOTAL_AFTER[sec.key]!, sec.key)}
                    </Fragment>
                  );
                })}

                {/* Fallback: accounts without ifrsSection */}
                {hasFallback && !hasSections && (
                  <>
                    {fallbackRevenue.length > 0 && (
                      <>
                        <tr className="border-b bg-muted/30">
                          <td colSpan={2} className="py-2 px-2 font-semibold text-sm">
                            Ingresos
                          </td>
                          {data.periods.map((_, i) => (
                            <td key={i} className="py-2 px-2 text-right text-xs font-semibold tabular-nums">
                              {formatCLP(sectionTotal(fallbackRevenue, i))}
                            </td>
                          ))}
                          <td className="py-2 px-2 text-right font-bold tabular-nums">
                            {formatCLP(sectionTotalAll(fallbackRevenue))}
                          </td>
                        </tr>
                        {renderAccountRows(fallbackRevenue)}
                      </>
                    )}
                    {fallbackExpense.length > 0 && (
                      <>
                        <tr className="border-b bg-muted/30">
                          <td colSpan={2} className="py-2 px-2 font-semibold text-sm">
                            Gastos
                          </td>
                          {data.periods.map((_, i) => (
                            <td key={i} className="py-2 px-2 text-right text-xs font-semibold tabular-nums">
                              {formatCLP(sectionTotal(fallbackExpense, i))}
                            </td>
                          ))}
                          <td className="py-2 px-2 text-right font-bold tabular-nums">
                            {formatCLP(sectionTotalAll(fallbackExpense))}
                          </td>
                        </tr>
                        {renderAccountRows(fallbackExpense)}
                      </>
                    )}
                  </>
                )}

                {/* Resultado del Período (IAS 1.82f) */}
                {(() => {
                  const running = computeRunningTotals("TAX_EXPENSE");
                  const total = running.reduce((a, b) => a + b, 0);
                  const negative = total < 0;
                  return (
                    <tr className="border-t-2 bg-muted/50 font-bold">
                      <td colSpan={2} className="py-2 px-2 text-sm">
                        Resultado del Período
                      </td>
                      {running.map((v, i) => (
                        <td
                          key={i}
                          className={cn(
                            "py-2 px-2 text-right tabular-nums",
                            v >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"
                          )}
                        >
                          {v >= 0 ? "+" : ""}{formatCLP(v)}
                        </td>
                      ))}
                      <td
                        className={cn(
                          "py-2 px-2 text-right tabular-nums",
                          negative ? "text-destructive" : "text-green-600 dark:text-green-400"
                        )}
                      >
                        {total >= 0 ? "+" : ""}{formatCLP(total)}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        ) : data?.periods.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No hay períodos fiscales en {year}. Crea períodos mensuales en Contabilidad.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
