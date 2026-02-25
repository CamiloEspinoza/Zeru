"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import type { JournalEntry, JournalEntryStatus } from "@zeru/shared";
import { downloadExcel } from "@/lib/export-excel";

interface JournalEntriesResponse {
  data: JournalEntry[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

/** Entry with lines that include account (from API) */
interface JournalEntryWithLines extends Omit<JournalEntry, "lines"> {
  lines: Array<{
    id: string;
    accountId: string;
    debit: number;
    credit: number;
    description?: string | null;
    account?: { code: string; name: string };
  }>;
}

const STATUS_BADGE: Record<
  JournalEntryStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  DRAFT: { variant: "secondary", label: "Borrador" },
  POSTED: { variant: "default", label: "Contabilizado" },
  VOIDED: { variant: "destructive", label: "Anulado" },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "POSTED", label: "Contabilizado" },
  { value: "VOIDED", label: "Anulado" },
];

const PER_PAGE_OPTIONS = [10, 20, 50, 100];

export default function JournalPage() {
  const { tenant } = useTenantContext();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [meta, setMeta] = useState<JournalEntriesResponse["meta"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const status = searchParams.get("status") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(10, parseInt(searchParams.get("perPage") ?? "20", 10) || 20)
  );

  const setFilters = useCallback(
    (updates: { status?: string; page?: number; perPage?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined) {
        if (updates.status) params.set("status", updates.status);
        else params.delete("status");
      }
      if (updates.page !== undefined) {
        if (updates.page > 1) params.set("page", String(updates.page));
        else params.delete("page");
      }
      if (updates.perPage !== undefined) {
        if (updates.perPage !== 20) params.set("perPage", String(updates.perPage));
        else params.delete("perPage");
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    if (status) params.set("status", status);
    params.set("page", String(page));
    params.set("perPage", String(perPage));

    setLoading(true);
    api
      .get<JournalEntriesResponse>(`/accounting/journal-entries?${params.toString()}`, {
        tenantId,
      })
      .then((res) => {
        setEntries(res.data);
        setMeta(res.meta);
      })
      .catch((err) => setError(err.message ?? "Error al cargar asientos"))
      .finally(() => setLoading(false));
  }, [tenant?.id, status, page, perPage]);

  const handleExportExcel = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      params.set("perPage", "5000");
      const res = await api.get<JournalEntriesResponse>(
        `/accounting/journal-entries?${params.toString()}`,
        { tenantId }
      );
      const entriesWithLines = res.data as JournalEntryWithLines[];
      const rows: Record<string, string | number>[] = [];
      const sorted = [...entriesWithLines].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      for (const entry of sorted) {
        const dateStr = new Date(entry.date).toLocaleDateString("es-CL");
        for (const line of entry.lines ?? []) {
          rows.push({
            "Nº Asiento": entry.number,
            Fecha: dateStr,
            Glosa: entry.description,
            "Código Cuenta": (line as { account?: { code: string; name: string } }).account?.code ?? "",
            "Nombre Cuenta": (line as { account?: { code: string; name: string } }).account?.name ?? "",
            Débe: Number(line.debit) || 0,
            Haber: Number(line.credit) || 0,
          });
        }
      }
      downloadExcel(
        [{ name: "Libro Diario", rows }],
        `libro-diario-${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      setError((e as Error).message ?? "Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const totalPages = meta?.totalPages ?? 0;
  const total = meta?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Asientos Contables</h1>
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Asientos Contables</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || total === 0}
          >
            {exporting ? "Exportando…" : "Exportar a Excel"}
          </Button>
          <Button asChild>
            <Link href="/accounting/journal/new">Nuevo Asiento</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Asientos</CardTitle>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={status || "all"}
                onValueChange={(v) => {
                  setFilters({ status: v === "all" ? "" : v, page: 1 });
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value || "all"} value={o.value || "all"}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(perPage)}
                onValueChange={(v) => {
                  setFilters({ perPage: parseInt(v, 10), page: 1 });
                }}
              >
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PER_PAGE_OPTIONS.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} por página
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground py-4">Cargando...</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Número</th>
                      <th className="text-left py-2 px-3 font-medium">Fecha</th>
                      <th className="text-left py-2 px-3 font-medium">Descripción</th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const statusConfig = STATUS_BADGE[entry.status];
                      return (
                        <tr key={entry.id} className="border-b last:border-0">
                          <td className="py-2 px-3">
                            <Link
                              href={`/accounting/journal/${entry.id}`}
                              className="text-primary hover:underline font-medium"
                            >
                              #{entry.number}
                            </Link>
                          </td>
                          <td className="py-2 px-3">
                            {new Date(entry.date).toLocaleDateString("es-CL")}
                          </td>
                          <td className="py-2 px-3">{entry.description}</td>
                          <td className="py-2 px-3">
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {total === 0 && (
                <p className="text-muted-foreground py-6 text-center">
                  No hay asientos con los filtros seleccionados.
                </p>
              )}
              {total > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t mt-4">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {from}–{to} de {total}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setFilters({ page: page - 1 })}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setFilters({ page: page + 1 })}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
