"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export default function JournalPage() {
  const { tenant } = useTenantContext();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) {
      setLoading(false);
      return;
    }

    api
      .get<JournalEntriesResponse>("/accounting/journal-entries", { tenantId })
      .then((res) => setEntries(res.data))
      .catch((err) => setError(err.message ?? "Error al cargar asientos"))
      .finally(() => setLoading(false));
  }, [tenant?.id]);

  const handleExportExcel = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId) return;
    setExporting(true);
    try {
      const res = await api.get<JournalEntriesResponse>(
        "/accounting/journal-entries?perPage=5000",
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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Asientos Contables</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Asientos Contables</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || entries.length === 0}
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
          <CardTitle>Asientos</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  );
}
