"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCLP } from "@zeru/shared";

interface JournalEntryLine {
  id: string;
  debit: number | string;
  credit: number | string;
  description?: string | null;
  account?: { code: string; name: string };
}

interface JournalEntryData {
  id: string;
  number: number;
  date: string;
  description: string;
  status: "DRAFT" | "POSTED" | "VOIDED";
  lines: JournalEntryLine[];
}

interface JournalEntryReviewCardProps {
  entry: JournalEntryData;
  onApprove: (entryId: string, entryNumber: number) => void;
  approved?: boolean;
}

export function JournalEntryReviewCard({
  entry,
  onApprove,
  approved = false,
}: JournalEntryReviewCardProps) {
  const [confirming, setConfirming] = useState(false);

  const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleApprove = () => {
    setConfirming(true);
    onApprove(entry.id, entry.number);
  };

  const dateLabel = new Date(entry.date).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="my-3 rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          {/* Ledger icon */}
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary flex-shrink-0">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">Asiento #{entry.number}</span>
              {approved ? (
                <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
                  Contabilizado
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                  Borrador
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {dateLabel} · {entry.description}
            </p>
          </div>
        </div>

        {!isBalanced && (
          <span className="text-xs text-destructive font-medium">
            ⚠ Desbalanceado
          </span>
        )}
      </div>

      {/* Lines table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-left py-2 px-4 font-medium text-xs">Cuenta</th>
              <th className="text-right py-2 px-4 font-medium text-xs">Debe</th>
              <th className="text-right py-2 px-4 font-medium text-xs">Haber</th>
              <th className="text-left py-2 px-4 font-medium text-xs hidden sm:table-cell">Descripción</th>
            </tr>
          </thead>
          <tbody>
            {entry.lines.map((line) => (
              <tr key={line.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                <td className="py-2 px-4">
                  <span className="font-mono text-xs text-muted-foreground">{line.account?.code ?? "—"}</span>
                  {" "}
                  <span className="text-xs">{line.account?.name ?? ""}</span>
                </td>
                <td className="py-2 px-4 text-right font-mono text-xs tabular-nums">
                  {Number(line.debit) > 0 ? formatCLP(Number(line.debit)) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 px-4 text-right font-mono text-xs tabular-nums">
                  {Number(line.credit) > 0 ? formatCLP(Number(line.credit)) : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-2 px-4 text-xs text-muted-foreground hidden sm:table-cell">
                  {line.description ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20">
              <td className="py-2 px-4 text-xs font-semibold">Total</td>
              <td className="py-2 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                {formatCLP(totalDebit)}
              </td>
              <td className="py-2 px-4 text-right font-mono text-xs font-semibold tabular-nums">
                {formatCLP(totalCredit)}
              </td>
              <td className="hidden sm:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer / action */}
      <div className="px-4 py-3 border-t bg-muted/10 flex items-center justify-between gap-3">
        {approved ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Asiento aprobado y contabilizado</span>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Revisa el asiento. Si hay correcciones, descríbelas en el chat.
            </p>
            <Button
              size="sm"
              className="shrink-0"
              onClick={handleApprove}
              disabled={confirming || !isBalanced}
            >
              {confirming ? (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Aprobando...
                </span>
              ) : (
                "Aprobar y contabilizar"
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
