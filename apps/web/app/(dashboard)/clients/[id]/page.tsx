"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import { formatRut, formatCLP } from "@zeru/shared";
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

interface Contact {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  isPrimary: boolean;
  notes: string | null;
}

interface AgreementLine {
  id: string;
  factor: string;
  negotiatedPrice: string;
  referencePrice: string | null;
  currency: string;
  billingConcept: { id: string; code: string; name: string };
}

interface NestedAgreement {
  id: string;
  code: string;
  name: string;
  status: StatusKey;
  paymentTerms: PaymentTermsKey;
  customPaymentDays: number | null;
  billingDayOfMonth: number | null;
  billingModalities: ModalityKey[];
  isMonthlySettlement: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  contractDate: string | null;
  _count: { lines: number; contacts: number; labOrigins: number };
  lines: AgreementLine[];
  contacts: Contact[];
}

interface NestedOrigin {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  commune: string | null;
  city: string | null;
}

interface BankAccount {
  id: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  holderName: string;
  holderRut: string | null;
  isPrimary: boolean;
}

interface ClientDetail {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  businessActivity: string | null;
  isClient: boolean;
  isSupplier: boolean;
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  isActive: boolean;
  contacts: Contact[];
  bankAccounts: BankAccount[];
  labOrigins: NestedOrigin[];
  billingAgreements: NestedAgreement[];
}

function joinAddress(c: ClientDetail): string {
  const street = [c.street, c.streetNumber, c.unit].filter(Boolean).join(" ");
  const locality = [c.commune, c.city].filter(Boolean).join(", ");
  return [street, locality].filter(Boolean).join(" — ") || "—";
}

function formatPaymentTerms(a: NestedAgreement): string {
  if (a.paymentTerms === "CUSTOM" && a.customPaymentDays != null) {
    return `${a.customPaymentDays} días`;
  }
  return PAYMENT_TERMS_LABELS[a.paymentTerms];
}

function ClientDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenant } = useTenantContext();

  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tab = searchParams.get("tab") ?? "convenios";
  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "convenios") params.delete("tab");
    else params.set("tab", next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const fetchClient = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<ClientDetail>(`/legal-entities/${id}`, { tenantId })
      .then(setClient)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar cliente");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(() => {
    Promise.resolve().then(fetchClient);
  }, [fetchClient]);

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
          <p className="text-lg font-medium">Cliente no encontrado</p>
          <Button variant="outline" onClick={() => router.push("/clients")}>Volver</Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !client) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchClient}>Reintentar</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/clients")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Clientes
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-lg text-muted-foreground">
            {formatRut(client.rut)}
          </span>
          <h1 className="text-2xl font-bold">{client.legalName}</h1>
          {client.tradeName && (
            <span className="text-muted-foreground">({client.tradeName})</span>
          )}
        </div>
        <div className="flex gap-1.5 mt-2">
          {client.isClient && <Badge variant="default">Cliente</Badge>}
          {client.isSupplier && <Badge variant="secondary">Proveedor</Badge>}
          <Badge variant={client.isActive ? "default" : "outline"}>
            {client.isActive ? "Activo" : "Inactivo"}
          </Badge>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="convenios">
            Convenios ({client.billingAgreements.length})
          </TabsTrigger>
          <TabsTrigger value="procedencias">
            Procedencias ({client.labOrigins.length})
          </TabsTrigger>
          <TabsTrigger value="datos">Datos generales</TabsTrigger>
          <TabsTrigger value="contactos">
            Contactos ({client.contacts.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="convenios" className="space-y-4">
          {client.billingAgreements.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Este cliente no tiene convenios asociados.
              </CardContent>
            </Card>
          ) : (
            client.billingAgreements.map((a) => (
              <Card key={a.id}>
                <Collapsible defaultOpen={client.billingAgreements.length <= 3}>
                  <CollapsibleTrigger className="w-full">
                    <CardHeader className="cursor-pointer hover:bg-muted/40">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/collections/agreements/${a.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-primary hover:underline"
                          >
                            {a.code}
                          </Link>
                          <span className="font-medium">{a.name}</span>
                          <Badge variant={STATUS_BADGE_VARIANT[a.status]}>
                            {STATUS_LABELS[a.status]}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatPaymentTerms(a)} · {a._count.lines} líneas ·{" "}
                          {a._count.labOrigins} procedencias
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4">
                      {a.billingModalities?.length > 0 && (
                        <div className="flex gap-1.5 flex-wrap">
                          {a.billingModalities.map((m) => (
                            <Badge key={m} variant="outline">
                              {MODALITY_LABELS[m]}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {a.lines.length === 0 ? (
                        <p className="text-muted-foreground py-2">
                          Sin precios acordados.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-2 px-3 font-medium">Código</th>
                                <th className="text-left py-2 px-3 font-medium">Concepto</th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Factor
                                </th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Negociado
                                </th>
                                <th className="text-right py-2 px-3 font-medium">
                                  Referencia
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.lines.map((l) => (
                                <tr key={l.id} className="border-b last:border-0">
                                  <td className="py-2 px-3 font-mono">
                                    {l.billingConcept.code}
                                  </td>
                                  <td className="py-2 px-3">{l.billingConcept.name}</td>
                                  <td className="py-2 px-3 text-right tabular-nums">
                                    {Number(l.factor).toFixed(2)}
                                  </td>
                                  <td className="py-2 px-3 text-right tabular-nums font-medium">
                                    {formatCLP(l.negotiatedPrice)}
                                  </td>
                                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                                    {l.referencePrice ? formatCLP(l.referencePrice) : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {a.contacts.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">
                            Contactos de cobranza
                          </h4>
                          <ul className="space-y-1 text-sm">
                            {a.contacts.map((c) => (
                              <li key={c.id} className="flex flex-wrap gap-x-3">
                                <span className="font-medium">{c.name}</span>
                                {c.role && (
                                  <span className="text-muted-foreground">{c.role}</span>
                                )}
                                {c.email && (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="text-primary hover:underline"
                                  >
                                    {c.email}
                                  </a>
                                )}
                                {c.phone && (
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="text-primary hover:underline"
                                  >
                                    {c.phone}
                                  </a>
                                )}
                                {c.isPrimary && (
                                  <Badge variant="default">Principal</Badge>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="procedencias">
          <Card>
            <CardContent className="pt-6">
              {client.labOrigins.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Este cliente no tiene procedencias asociadas.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium">Código</th>
                        <th className="text-left py-2 px-3 font-medium">Nombre</th>
                        <th className="text-left py-2 px-3 font-medium">Categoría</th>
                        <th className="text-left py-2 px-3 font-medium hidden md:table-cell">
                          Comuna
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.labOrigins.map((o) => (
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
                          <td className="py-2 px-3 hidden md:table-cell">
                            {o.commune ?? "—"}
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
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Dirección</dt>
                  <dd>{joinAddress(client)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Teléfono</dt>
                  <dd>
                    {client.phone ? (
                      <a href={`tel:${client.phone}`} className="text-primary hover:underline">
                        {client.phone}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd>
                    {client.email ? (
                      <a
                        href={`mailto:${client.email}`}
                        className="text-primary hover:underline"
                      >
                        {client.email}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Sitio web</dt>
                  <dd>
                    {client.website ? (
                      <a
                        href={
                          client.website.startsWith("http")
                            ? client.website
                            : `https://${client.website}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {client.website}
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-muted-foreground">Giro</dt>
                  <dd>{client.businessActivity ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contactos">
          <Card>
            <CardContent className="pt-6">
              {client.contacts.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center">
                  Sin contactos generales.
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
                      </tr>
                    </thead>
                    <tbody>
                      {client.contacts.map((c) => (
                        <tr key={c.id} className="border-b last:border-0">
                          <td className="py-2 px-3">
                            {c.name}
                            {c.isPrimary && (
                              <Badge variant="default" className="ml-2">
                                Principal
                              </Badge>
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
                              <a
                                href={`tel:${c.phone}`}
                                className="text-primary hover:underline"
                              >
                                {c.phone}
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
      </Tabs>
    </div>
  );
}

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense>
      <ClientDetailContent id={id} />
    </Suspense>
  );
}
