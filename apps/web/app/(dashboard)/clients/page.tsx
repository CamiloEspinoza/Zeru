"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import { formatRut } from "@zeru/shared";

interface LegalEntityRow {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  commune: string | null;
  phone: string | null;
  isClient: boolean;
  isSupplier: boolean;
  isActive: boolean;
  _count: { labOrigins: number; billingAgreements: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function ClientsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [entities, setEntities] = useState<LegalEntityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [clientOnly, setClientOnly] = useState(searchParams.get("client") !== "false");
  const [supplierOnly, setSupplierOnly] = useState(searchParams.get("supplier") === "true");
  const [activeOnly, setActiveOnly] = useState(searchParams.get("active") !== "false");

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (!clientOnly) params.set("client", "false");
    if (supplierOnly) params.set("supplier", "true");
    if (!activeOnly) params.set("active", "false");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, clientOnly, supplierOnly, activeOnly, pathname, router]);

  useEffect(
    () => setPage(1),
    [debouncedSearch, clientOnly, supplierOnly, activeOnly, setPage],
  );

  const fetchEntities = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<LegalEntityRow[]>("/legal-entities", { tenantId })
      .then(setEntities)
      .catch((err) => setError(err.message ?? "Error al cargar clientes"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(fetchEntities);
  }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return entities.filter((e) => {
      if (activeOnly && !e.isActive) return false;
      if (clientOnly && !e.isClient) return false;
      if (supplierOnly && !e.isSupplier) return false;
      if (needle) {
        const hay = normalize(`${e.rut} ${e.legalName} ${e.tradeName ?? ""}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [entities, debouncedSearch, clientOnly, supplierOnly, activeOnly]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los clientes</p>
            <Button variant="outline" onClick={fetchEntities}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Personas jurídicas: clientes, proveedores y derivadores.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Personas jurídicas</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar RUT, razón social o fantasía…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[280px]"
              />
              <Button
                variant={clientOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setClientOnly((v) => !v)}
              >
                Clientes
              </Button>
              <Button
                variant={supplierOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setSupplierOnly((v) => !v)}
              >
                Proveedores
              </Button>
              <Button
                variant={activeOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveOnly((v) => !v)}
              >
                Solo activos
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3 py-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3 font-medium">RUT</th>
                      <th className="text-left py-2 px-3 font-medium">Razón social</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Comuna
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Teléfono
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Convenios</th>
                      <th className="text-right py-2 px-3 font-medium">Procedencias</th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/clients/${e.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{formatRut(e.rut)}</td>
                        <td className="py-2 px-3">
                          <div>{e.legalName}</div>
                          {e.tradeName && (
                            <div className="text-xs text-muted-foreground">{e.tradeName}</div>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">{e.commune ?? "—"}</td>
                        <td className="py-2 px-3 hidden md:table-cell">{e.phone ?? "—"}</td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {e._count.billingAgreements}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">
                          {e._count.labOrigins}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={e.isActive ? "default" : "outline"}>
                            {e.isActive ? "Activo" : "Inactivo"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {total === 0 && !loading && (
                <p className="text-muted-foreground py-8 text-center">
                  {debouncedSearch
                    ? `Sin resultados para "${debouncedSearch}"`
                    : "No hay clientes."}
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

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsListContent />
    </Suspense>
  );
}
