"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import type { JournalEntry, JournalEntryLine, JournalEntryStatus } from "@zeru/shared";

interface JournalEntryWithLines extends JournalEntry {
  lines: (JournalEntryLine & { account?: { code: string; name: string } })[];
}

const STATUS_BADGE: Record<
  JournalEntryStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  DRAFT: { variant: "secondary", label: "Borrador" },
  POSTED: { variant: "default", label: "Contabilizado" },
  VOIDED: { variant: "destructive", label: "Anulado" },
};

export default function JournalEntryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { tenant } = useTenantContext();
  const id = params.id as string;
  const [entry, setEntry] = useState<JournalEntryWithLines | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !id) {
      setLoading(false);
      return;
    }

    api
      .get<JournalEntryWithLines>(`/accounting/journal-entries/${id}`, {
        tenantId,
      })
      .then(setEntry)
      .catch((err) => setError(err.message ?? "Error al cargar asiento"))
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  const handlePost = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !id) return;
    setActionLoading(true);
    try {
      await api.patch(`/accounting/journal-entries/${id}/post`, {}, { tenantId });
      router.refresh();
      const updated = await api.get<JournalEntryWithLines>(
        `/accounting/journal-entries/${id}`,
        { tenantId }
      );
      setEntry(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al contabilizar");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoid = async () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenant_id");
    if (!tenantId || !id) return;
    setActionLoading(true);
    try {
      await api.patch(`/accounting/journal-entries/${id}/void`, {}, { tenantId });
      router.refresh();
      const updated = await api.get<JournalEntryWithLines>(
        `/accounting/journal-entries/${id}`,
        { tenantId }
      );
      setEntry(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al anular");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Asiento Contable</h1>
        <p className="text-muted-foreground">Cargando...</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Asiento Contable</h1>
        <p className="text-destructive">{error ?? "Asiento no encontrado"}</p>
        <Button asChild variant="outline">
          <Link href="/accounting/journal">Volver</Link>
        </Button>
      </div>
    );
  }

  const statusConfig = STATUS_BADGE[entry.status];
  // Prisma Decimal fields come as strings in JSON — coerce to number before reducing
  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Asiento #{entry.number}</h1>
          <p className="text-muted-foreground">
            {new Date(entry.date).toLocaleDateString("es-CL")} ·{" "}
            {entry.description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          <Button asChild variant="outline" size="sm">
            <Link href="/accounting/journal">Volver</Link>
          </Button>
          {entry.status === "DRAFT" && (
            <Button size="sm" onClick={handlePost} disabled={actionLoading}>
              Contabilizar
            </Button>
          )}
          {entry.status === "POSTED" && (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleVoid}
              disabled={actionLoading}
            >
              Anular
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Líneas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Cuenta</th>
                  <th className="text-right py-2 px-3 font-medium">Debe</th>
                  <th className="text-right py-2 px-3 font-medium">Haber</th>
                  <th className="text-left py-2 px-3 font-medium">Descripción</th>
                </tr>
              </thead>
              <tbody>
                {entry.lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2 px-3">
                      <span className="font-mono">
                        {line.account?.code ?? "-"}
                      </span>{" "}
                      {line.account?.name ?? ""}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {Number(line.debit) > 0 ? formatCLP(Number(line.debit)) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {Number(line.credit) > 0 ? formatCLP(Number(line.credit)) : "—"}
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">
                      {line.description ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-2 px-3">Total</td>
                  <td className="py-2 px-3 text-right">
                    {formatCLP(totalDebit)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCLP(totalCredit)}
                  </td>
                  <td className="py-2 px-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
