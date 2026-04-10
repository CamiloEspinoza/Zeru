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
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { usePagination } from "@/hooks/use-pagination";
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  PAYMENT_TERMS_LABELS,
  type StatusKey,
  type PaymentTermsKey,
} from "@/lib/enum-labels";

interface AgreementRow {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isMonthlySettlement: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  _count: { lines: number; contacts: number; labOrigins: number };
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function isExpiringSoon(effectiveTo: string | null): boolean {
  if (!effectiveTo) return false;
  const end = new Date(effectiveTo).getTime();
  const now = Date.now();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  return end - now > 0 && end - now <= sixtyDays;
}

function AgreementsListContent() {
  const { tenant } = useTenantContext();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { search, debouncedSearch, setSearch } = useDebouncedSearch(300);
  const { page, perPage, setPage } = usePagination(
    Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1),
    20,
  );
  const [status, setStatus] = useState<StatusKey | "ALL">(
    (searchParams.get("status") as StatusKey | null) ?? "ALL",
  );
  const [monthlyOnly, setMonthlyOnly] = useState(searchParams.get("monthly") === "true");
  const [expiring, setExpiring] = useState(searchParams.get("expiring") === "true");

  useEffect(() => {
    const initial = searchParams.get("search");
    if (initial) setSearch(initial);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (page > 1) params.set("page", String(page));
    if (status !== "ALL") params.set("status", status);
    if (monthlyOnly) params.set("monthly", "true");
    if (expiring) params.set("expiring", "true");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [debouncedSearch, page, status, monthlyOnly, expiring, pathname, router]);

  useEffect(() => setPage(1), [debouncedSearch, status, monthlyOnly, expiring, setPage]);

  const fetchAgreements = () => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    api
      .get<AgreementRow[]>("/billing-agreements", { tenantId })
      .then(setAgreements)
      .catch((err) => setError(err.message ?? "Error al cargar convenios"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    Promise.resolve().then(fetchAgreements);
  }, [tenant?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = debouncedSearch ? normalize(debouncedSearch) : "";
    return agreements.filter((a) => {
      if (status !== "ALL" && a.status !== status) return false;
      if (monthlyOnly && !a.isMonthlySettlement) return false;
      if (expiring && !isExpiringSoon(a.effectiveTo)) return false;
      if (needle) {
        const hay = normalize(`${a.code} ${a.name}`);
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [agreements, debouncedSearch, status, monthlyOnly, expiring]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, totalPages);
  const from = total === 0 ? 0 : (safePage - 1) * perPage + 1;
  const to = Math.min(safePage * perPage, total);
  const visible = filtered.slice((safePage - 1) * perPage, safePage * perPage);

  const formatPaymentTerms = (a: AgreementRow): string => {
    if (a.paymentTerms === "CUSTOM" && a.customPaymentDays != null) {
      return `${a.customPaymentDays} días`;
    }
    return PAYMENT_TERMS_LABELS[a.paymentTerms];
  };

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Convenios</h1>
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-destructive">No se pudieron cargar los convenios</p>
            <Button variant="outline" onClick={fetchAgreements}>Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convenios</h1>
        <p className="text-sm text-muted-foreground">
          Acuerdos comerciales con clientes: precios, plazos y modalidades de cobro.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Convenios</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Buscar código o nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-[220px]"
              />
              <Select value={status} onValueChange={(v) => setStatus(v as StatusKey | "ALL")}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos</SelectItem>
                  <SelectItem value="ACTIVE">Vigente</SelectItem>
                  <SelectItem value="EXPIRED">Expirado</SelectItem>
                  <SelectItem value="DRAFT">Borrador</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={monthlyOnly ? "default" : "outline"}
                size="sm"
                onClick={() => setMonthlyOnly((v) => !v)}
              >
                Liquidación mensual
              </Button>
              <Button
                variant={expiring ? "default" : "outline"}
                size="sm"
                onClick={() => setExpiring((v) => !v)}
              >
                Expira en 60 días
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
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Nombre</th>
                      <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">
                        Cliente
                      </th>
                      <th className="text-left py-2 px-3 font-medium">Estado</th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Plazo pago
                      </th>
                      <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                        Vence
                      </th>
                      <th className="text-right py-2 px-3 font-medium">Líneas</th>
                      <th className="text-right py-2 px-3 font-medium hidden md:table-cell">
                        Procedencias
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                        onClick={() => router.push(`/collections/agreements/${a.id}`)}
                      >
                        <td className="py-2 px-3 font-mono">{a.code}</td>
                        <td className="py-2 px-3">{a.name}</td>
                        <td className="py-2 px-3 hidden lg:table-cell">
                          {a.legalEntity ? (
                            <Link
                              href={`/clients/${a.legalEntity.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-primary hover:underline"
                            >
                              {a.legalEntity.legalName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-3">
                          <Badge variant={STATUS_BADGE_VARIANT[a.status]}>
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">
                          {formatPaymentTerms(a)}
                        </td>
                        <td className="py-2 px-3 hidden md:table-cell">
                          {a.effectiveTo
                            ? new Date(a.effectiveTo).toLocaleDateString("es-CL")
                            : "—"}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums">{a._count.lines}</td>
                        <td className="py-2 px-3 text-right tabular-nums hidden md:table-cell">
                          {a._count.labOrigins}
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
                    : "No hay convenios."}
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

export default function AgreementsListPage() {
  return (
    <Suspense>
      <AgreementsListContent />
    </Suspense>
  );
}
