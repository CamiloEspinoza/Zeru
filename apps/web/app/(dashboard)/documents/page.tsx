"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import {
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
  type DocumentRecord,
} from "@zeru/shared";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Category badge colors ────────────────────────────────

const CATEGORY_COLORS: Record<DocumentCategory, string> = {
  FACTURA: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  BOLETA: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  NOTA_CREDITO: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  NOTA_DEBITO: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CONTRATO: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  ESTATUTOS: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  DECLARACION: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  COMPROBANTE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  REMUNERACION: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  OTRO: "bg-muted text-muted-foreground",
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const CATEGORIES = Object.entries(DOCUMENT_CATEGORY_LABELS) as [
  DocumentCategory,
  string,
][];

// ─── Page ─────────────────────────────────────────────────

interface PaginatedDocs {
  data: DocumentRecord[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

export default function DocumentsPage() {
  const router = useRouter();

  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [category, setCategory] = useState<string>("ALL");
  const [tag, setTag] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category !== "ALL") params.set("category", category);
      if (tag.trim()) params.set("tag", tag.trim());
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("page", String(page));
      params.set("perPage", "20");

      const res = await api.get<PaginatedDocs>(`/files?${params}`);
      setDocs(res.data ?? []);
      setMeta(res.meta);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [category, tag, from, to, page]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [category, tag, from, to]);

  const handleDownload = async (doc: DocumentRecord) => {
    try {
      const detail = await api.get<DocumentRecord>(`/files/${doc.id}`);
      if (detail.downloadUrl) window.open(detail.downloadUrl, "_blank");
    } catch {
      // ignore
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("¿Eliminar este documento? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/files/${docId}`);
      fetchDocs();
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Documentos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Archivos adjuntos clasificados automáticamente por el asistente IA.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="w-44">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas las categorías</SelectItem>
              {CATEGORIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-36">
          <Input
            placeholder="Buscar tag…"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-36"
          />
          <span className="text-muted-foreground text-sm">—</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-36"
          />
        </div>

        {(category !== "ALL" || tag || from || to) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCategory("ALL");
              setTag("");
              setFrom("");
              setTo("");
            }}
          >
            Limpiar filtros
          </Button>
        )}

        <p className="ml-auto text-sm text-muted-foreground">
          {meta.total} documento{meta.total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left py-3 px-4 font-medium">Nombre</th>
              <th className="text-left py-3 px-4 font-medium">Categoría</th>
              <th className="text-left py-3 px-4 font-medium">Tags</th>
              <th className="text-left py-3 px-4 font-medium">Asientos</th>
              <th className="text-left py-3 px-4 font-medium">Fecha</th>
              <th className="text-left py-3 px-4 font-medium">Tamaño</th>
              <th className="py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-muted-foreground">
                  <div className="flex justify-center">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                </td>
              </tr>
            ) : docs.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <svg className="h-10 w-10 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <p className="text-sm">
                      {category !== "ALL" || tag || from || to
                        ? "No hay documentos que coincidan con los filtros."
                        : "Todavía no hay documentos. Adjunta archivos en el asistente para clasificarlos."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              docs.map((doc) => (
                <tr
                  key={doc.id}
                  className="border-t hover:bg-muted/30 transition-colors"
                >
                  {/* Name */}
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="flex items-center gap-2 text-left hover:text-primary transition-colors"
                    >
                      <FileIcon mimeType={doc.mimeType} />
                      <span className="max-w-[180px] truncate font-medium">{doc.name}</span>
                    </button>
                    {doc.conversation && (
                      <button
                        type="button"
                        onClick={() => router.push(`/assistant/${doc.conversation!.id}`)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-0.5 block truncate max-w-[180px]"
                      >
                        ↗ {doc.conversation.title}
                      </button>
                    )}
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        CATEGORY_COLORS[doc.category] ?? CATEGORY_COLORS.OTRO,
                      )}
                    >
                      {DOCUMENT_CATEGORY_LABELS[doc.category] ?? doc.category}
                    </span>
                  </td>

                  {/* Tags */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {doc.tags?.length ? (
                        doc.tags.slice(0, 4).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs py-0">
                            {t}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                      {(doc.tags?.length ?? 0) > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{doc.tags.length - 4}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Journal entries */}
                  <td className="py-3 px-4">
                    {doc.journalEntries?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {doc.journalEntries.map(({ journalEntry: je }) => (
                          <button
                            key={je.id}
                            type="button"
                            onClick={() => router.push(`/accounting/journal`)}
                            className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-xs hover:bg-muted transition-colors"
                            title={je.description}
                          >
                            #{je.number}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">
                    {formatDate(doc.createdAt)}
                  </td>

                  {/* Size */}
                  <td className="py-3 px-4 text-muted-foreground">
                    {formatBytes(doc.sizeBytes)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        type="button"
                        onClick={() => handleDownload(doc)}
                        title="Descargar"
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id)}
                        title="Eliminar"
                        className="p-1.5 text-muted-foreground hover:text-destructive rounded-md hover:bg-muted transition-colors"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {meta.page} de {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page === meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── File icon by MIME type ───────────────────────────────

function FileIcon({ mimeType }: { mimeType: string }) {
  const color = mimeType === "application/pdf"
    ? "text-red-500"
    : mimeType.startsWith("image/")
    ? "text-blue-500"
    : mimeType === "text/csv"
    ? "text-green-500"
    : "text-muted-foreground";

  return (
    <svg
      className={cn("h-4 w-4 shrink-0", color)}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
