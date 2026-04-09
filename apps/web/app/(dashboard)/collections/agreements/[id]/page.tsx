"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatCLP } from "@zeru/shared";
import {
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  PAYMENT_TERMS_LABELS,
  MODALITY_LABELS,
  CATEGORY_LABELS,
  type StatusKey,
  type PaymentTermsKey,
  type ModalityKey,
  type CategoryKey,
} from "@/lib/enum-labels";

interface AgreementLine {
  id: string;
  factor: string;
  negotiatedPrice: string;
  referencePrice: string | null;
  currency: string;
  billingConcept: { id: string; code: string; name: string };
}

interface AgreementContact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface AgreementOrigin {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
}

interface AgreementDetail {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  contractDate: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  isMonthlySettlement: boolean;
  billingModalities: ModalityKey[];
  examTypes: string[];
  notes: string | null;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  lines: AgreementLine[];
  contacts: AgreementContact[];
  labOrigins: AgreementOrigin[];
}

function fmtDate(s: string | null): string {
  return s ? new Date(s).toLocaleDateString("es-CL") : "—";
}

function AgreementDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenant } = useTenantContext();

  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "lineas";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "lineas") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const fetchAgreement = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<AgreementDetail>(`/billing-agreements/${id}`, { tenantId })
      .then(setAgreement)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar convenio");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(() => {
    Promise.resolve().then(fetchAgreement);
  }, [fetchAgreement]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg font-medium">Convenio no encontrado</p>
          <Button variant="outline" onClick={() => router.push("/collections/agreements")}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !agreement) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchAgreement}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  const formatPaymentTerms = (): string => {
    if (agreement.paymentTerms === "CUSTOM" && agreement.customPaymentDays != null) {
      return `${agreement.customPaymentDays} días`;
    }
    return PAYMENT_TERMS_LABELS[agreement.paymentTerms];
  };

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/collections/agreements")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Convenios
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{agreement.code}</h1>
          <span className="text-2xl font-medium">{agreement.name}</span>
          <Badge variant={STATUS_BADGE_VARIANT[agreement.status]}>
            {STATUS_LABELS[agreement.status]}
          </Badge>
        </div>
        {agreement.legalEntity && (
          <Link
            href={`/clients/${agreement.legalEntity.id}`}
            className="text-sm text-primary hover:underline mt-1 inline-block"
          >
            {agreement.legalEntity.legalName}
          </Link>
        )}
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="lineas">Líneas de precio</TabsTrigger>
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="contactos">Contactos</TabsTrigger>
          <TabsTrigger value="procedencias">Procedencias</TabsTrigger>
        </TabsList>

        <TabsContent value="lineas">
          <Card>
            <CardHeader>
              <CardTitle>Líneas ({agreement.lines.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.lines.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin precios acordados.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Concepto</th>
                        <th className="text-right py-2 px-3 font-medium">Precio referencia</th>
                        <th className="text-right py-2 px-3 font-medium">Factor</th>
                        <th className="text-right py-2 px-3 font-medium">Precio negociado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.lines.map((l) => (
                        <tr key={l.id} className="border-b last:border-0">
                          <td className="py-2 px-3 font-mono">{l.billingConcept.code}</td>
                          <td className="py-2 px-3">{l.billingConcept.name}</td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {l.referencePrice ? formatCLP(l.referencePrice) : "—"}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums">
                            {Number(l.factor).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right tabular-nums font-medium">
                            {formatCLP(l.negotiatedPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="datos">
          <Card>
            <CardContent className="pt-6">
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Fecha contrato</dt>
                  <dd>{fmtDate(agreement.contractDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Vigencia</dt>
                  <dd>
                    {fmtDate(agreement.effectiveFrom)} → {fmtDate(agreement.effectiveTo)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Plazo de pago</dt>
                  <dd>{formatPaymentTerms()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Día facturación</dt>
                  <dd>{agreement.billingDayOfMonth ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Liquidación mensual</dt>
                  <dd>{agreement.isMonthlySettlement ? "Sí" : "No"}</dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Modalidades de cobro</dt>
                  <dd className="flex gap-1.5 flex-wrap mt-1">
                    {agreement.billingModalities?.length ? (
                      agreement.billingModalities.map((m) => (
                        <Badge key={m} variant="outline">
                          {MODALITY_LABELS[m]}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Tipos de examen</dt>
                  <dd className="flex gap-1.5 flex-wrap mt-1">
                    {agreement.examTypes?.length ? (
                      agreement.examTypes.map((t) => (
                        <Badge key={t} variant="secondary">
                          {t}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </dd>
                </div>
                {agreement.notes && (
                  <div className="md:col-span-2">
                    <dt className="text-muted-foreground">Notas</dt>
                    <dd className="whitespace-pre-wrap">{agreement.notes}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos">
          <Card>
            <CardHeader>
              <CardTitle>Contactos de cobranza ({agreement.contacts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.contacts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin contactos de cobranza.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Cargo</th>
                        <th className="text-left py-2 px-3 font-medium">Email</th>
                        <th className="text-left py-2 px-3 font-medium">Teléfono</th>
                        <th className="text-left py-2 px-3 font-medium">Móvil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.contacts.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3">
                            {c.name}
                            {c.isPrimary && (
                              <Badge variant="default" className="ml-2">Principal</Badge>
                            )}
                          </td>
                          <td className="py-2 px-3">{c.role ?? "—"}</td>
                          <td className="py-2 px-3">
                            {c.email ? (
                              <a
                                href={`mailto:${c.email}`}
                                className="text-primary hover:underline"
                              >
                                {c.email}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {c.phone ? (
                              <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                                {c.phone}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {c.mobile ? (
                              <a href={`tel:${c.mobile}`} className="text-primary hover:underline">
                                {c.mobile}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="procedencias">
          <Card>
            <CardHeader>
              <CardTitle>Procedencias ({agreement.labOrigins.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {agreement.labOrigins.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin procedencias vinculadas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Categoría</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agreement.labOrigins.map((o) => (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AgreementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <AgreementDetailContent id={id} />
    </Suspense>
  );
}
