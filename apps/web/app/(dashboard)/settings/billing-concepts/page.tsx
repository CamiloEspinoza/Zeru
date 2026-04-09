"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";

interface BillingConcept {
  id: string;
  code: string;
  name: string;
  description: string | null;
  referencePrice: string;
  currency: string;
  isActive: boolean;
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function CatalogPageContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const initialPage = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const initialSearch = searchParams.get("search") ?? "";

  const [concepts, setConcepts] = useState<BillingConcept[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(initialPage, 20);

  // Seed search from URL on first render
  useEffect(() => {
    if (initialSearch) setSearch(initialSearch);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist page + search to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, pathname, router]);

  // Reset page to 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, setPage]);

  const fetchConcepts = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .get<BillingConcept[]>("/billing-concepts", { tenantId })
      .then(setConcepts)
      .catch((err) => setError(err.message ?? "Error al cargar conceptos"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(fetchConcepts);
  }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!debouncedSearch) return concepts;
    const needle = normalize(debouncedSearch);
    return concepts.filter((c) => {
      const haystack = normalize(`${c.code} ${c.name}`);
      return haystack.includes(needle);
    });
  }, [concepts, debouncedSearch]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Catálogo CDC</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los conceptos</p>
            <Button variant="outline" onClick={fetchConcepts}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Catálogo CDC</h1>
        <p className="text-sm text-muted-foreground">
          Códigos FONASA y precios de referencia. Datos sincronizados desde FileMaker.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <CardTitle>Conceptos</CardTitle>
            <Input
              placeholder="Buscar por código o nombre…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Descripción
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Precio referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    <TooltipProvider delayDuration={200}>
                      {visible.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-mono">{c.code}</td>
                          <td className="py-2 px-3">{c.name}</td>
                          <td className="py-2 px-3 hidden md:table-cell text-muted-foreground">
                            {c.description ? (
                              c.description.length > 60 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      {c.description.slice(0, 60)}…
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    {c.description}
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                c.description
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {formatCLP(c.referencePrice)}
                          </td>
                        </tr>
                      ))}
                    </TooltipProvider>
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay conceptos cargados."}
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
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage(safePage + 1)}
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

export default function BillingConceptsPage() {
  return (
    <Suspense>
      <CatalogPageContent />
    </Suspense>
  );
}
