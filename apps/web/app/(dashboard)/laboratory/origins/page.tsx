"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon,
  File02Icon,
  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import {
  CATEGORY_LABELS,
  type CategoryKey,
  type StatusKey,
} from "@/lib/enum-labels";

interface LabOriginRow {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  commune: string | null;
  city: string | null;
  isActive: boolean;
  reportDeliveryMethods: string[];
  legalEntity: { id: string; rut: string; legalName: string } | null;
  billingAgreement: { id: string; code: string; name: string; status: StatusKey } | null;
  parent: { id: string; code: string; name: string } | null;
  _count: { children: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function OriginsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [origins, setOrigins] = useState<LabOriginRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [category, setCategory] = useState<CategoryKey | "ALL">(
    (searchParams.get("category") as CategoryKey | null) ?? "ALL",
  );
  const [activeOnly, setActiveOnly] = useState(searchParams.get("active") !== "false");
  const [hasFtp, setHasFtp] = useState(searchParams.get("ftp") === "true");
  const [exporting, setExporting] = useState(false);

  async function handleExport(format: "xlsx" | "csv") {
    setExporting(true);
    try {
      const token = localStorage.getItem("access_token");
      const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3017/api";
      const res = await fetch(`${baseUrl}/lab-origins/export?format=${format}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-tenant-id": tenantId ?? "",
        },
      });
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `procedencias.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportado como ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (category !== "ALL") params.set("category", category);
    if (!activeOnly) params.set("active", "false");
    if (hasFtp) params.set("ftp", "true");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, category, activeOnly, hasFtp, pathname, router]);

  useEffect(() => setPage(1), [debouncedSearch, category, activeOnly, hasFtp, setPage]);

  const fetchOrigins = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<LabOriginRow[]>("/lab-origins", { tenantId })
      .then(setOrigins)
      .catch((err) => setError(err.message ?? "Error al cargar procedencias"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(fetchOrigins);
  }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return origins.filter((o) => {
      if (activeOnly && !o.isActive) return false;
      if (category !== "ALL" && o.category !== category) return false;
      if (hasFtp && !o.reportDeliveryMethods?.includes("FTP")) return false;
      if (needle) {
        const hay = normalize(`${o.code} ${o.name}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [origins, debouncedSearch, category, activeOnly, hasFtp]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Procedencias</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar las procedencias</p>
            <Button variant="outline" onClick={fetchOrigins}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Procedencias</h1>
        <p className="text-sm text-muted-foreground">
          Centros, consultas y clínicas que envían muestras al laboratorio.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Procedencias</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <HugeiconsIcon
                  icon={Search01Icon}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                />
                <Input
                  placeholder="Buscar código o nombre…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[220px] pl-8"
                />
              </div>
              <Select value={category} onValueChange={(v) => setCategory(v as CategoryKey | "ALL")}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas las categorías</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant={activeOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveOnly((v) => !v)}
              >
                Solo activas
              </Button>
              <Button
                variant={hasFtp ? "default" : "outline"}
                size="sm"
                onClick={() => setHasFtp((v) => !v)}
              >
                Con FTP
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting || loading}>
                    <HugeiconsIcon icon={Download01Icon} className="size-4" />
                    {exporting ? "Exportando..." : "Exportar"}
                    <HugeiconsIcon icon={ArrowDown01Icon} className="size-3 ml-0.5 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                    <HugeiconsIcon icon={File02Icon} className="size-4 text-green-600" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    <HugeiconsIcon icon={File02Icon} className="size-4 text-blue-600" />
                    CSV (.csv)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium">Categoría</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Cliente
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Convenio
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Comuna
                      </th>
                      <th className="text-left py-2 px-3 font-medium">FTP</th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((o) => (
                      <tr
                        key={o.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/laboratory/origins/${o.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{o.code}</td>
                        <td className="py-2 px-3">{o.name}</td>
                        <td className="py-2 px-3">
                          <Badge variant="secondary">{CATEGORY_LABELS[o.category]}</Badge>
                        </td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {o.legalEntity ? (
                            <Link
                              href={`/clients/${o.legalEntity.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {o.legalEntity.legalName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {o.billingAgreement ? (
                            <Link
                              href={`/collections/agreements/${o.billingAgreement.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline font-mono text-xs"
                            >
                              {o.billingAgreement.code}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">{o.commune ?? "—"}</td>
                        <td className="py-2 px-3">
                          {o.reportDeliveryMethods?.includes("FTP") ? (
                            <Badge variant="outline">FTP</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={o.isActive ? "default" : "outline"}>
                            {o.isActive ? "Activa" : "Inactiva"}
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
                    : "No hay procedencias."}
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

export default function OriginsListPage() {
  return (
    <Suspense>
      <OriginsListContent />
    </Suspense>
  );
}
