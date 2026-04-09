"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api-client";
import { useTenantContext } from "@/providers/tenant-provider";
import {
  CATEGORY_LABELS,
  RECEPTION_MODE_LABELS,
  DELIVERY_METHOD_LABELS,
  STATUS_LABELS,
  STATUS_BADGE_VARIANT,
  type CategoryKey,
  type ReceptionModeKey,
  type DeliveryMethodKey,
  type StatusKey,
} from "@/lib/enum-labels";

interface LabOriginDetail {
  id: string;
  code: string;
  name: string;
  category: CategoryKey;
  legalEntityId: string | null;
  parentId: string | null;
  billingAgreementId: string | null;
  street: string | null;
  streetNumber: string | null;
  unit: string | null;
  commune: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  sampleReceptionMode: ReceptionModeKey;
  reportDeliveryMethods: DeliveryMethodKey[];
  deliveryDaysBiopsy: number | null;
  deliveryDaysPap: number | null;
  deliveryDaysCytology: number | null;
  deliveryDaysIhc: number | null;
  deliveryDaysDefault: number | null;
  ftpPath: string | null;
  hasFtpHost: boolean;
  hasFtpUser: boolean;
  hasFtpPassword: boolean;
  criticalNotificationEmails: string[];
  sendsQualityReports: boolean;
  receptionDays: string | null;
  receptionSchedule: string | null;
  notes: string | null;
  isActive: boolean;
  legalEntity: { id: string; rut: string; legalName: string } | null;
  billingAgreement: {
    id: string;
    code: string;
    name: string;
    status: StatusKey;
  } | null;
  parent: { id: string; code: string; name: string } | null;
  children: Array<{ id: string; code: string; name: string; category: CategoryKey }>;
}

function joinAddress(o: LabOriginDetail): string {
  return [o.street, o.streetNumber, o.unit].filter(Boolean).join(" ") || "—";
}

export default function OriginDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { tenant } = useTenantContext();
  const [origin, setOrigin] = useState<LabOriginDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOrigin = useCallback(() => {
    const tenantId = tenant?.id ?? localStorage.getItem("tenantId");
    if (!tenantId) return setLoading(false);
    setLoading(true);
    setError(null);
    setNotFound(false);
    api
      .get<LabOriginDetail>(`/lab-origins/${id}`, { tenantId })
      .then(setOrigin)
      .catch((err) => {
        if (err?.message?.toLowerCase().includes("not found")) setNotFound(true);
        else setError(err.message ?? "Error al cargar procedencia");
      })
      .finally(() => setLoading(false));
  }, [tenant?.id, id]);

  useEffect(() => {
    Promise.resolve().then(fetchOrigin);
  }, [fetchOrigin]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-lg font-medium">Procedencia no encontrada</p>
          <Button variant="outline" onClick={() => router.push("/laboratory/origins")}>
            Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (error || !origin) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <p className="text-destructive">{error ?? "Error desconocido"}</p>
          <Button variant="outline" onClick={fetchOrigin}>Reintentar</Button>
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
          onClick={() => router.push("/laboratory/origins")}
          className="mb-2 -ml-2"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} className="size-4 mr-1" />
          Procedencias
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold font-mono">{origin.code}</h1>
          <span className="text-2xl font-medium">{origin.name}</span>
          <Badge variant="secondary">{CATEGORY_LABELS[origin.category]}</Badge>
          <Badge variant={origin.isActive ? "default" : "outline"}>
            {origin.isActive ? "Activa" : "Inactiva"}
          </Badge>
        </div>
      </div>

      <Alert>
        <AlertDescription>
          Datos sincronizados desde FileMaker. Las ediciones se realizan en FM.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Datos Generales</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Código</dt>
              <dd className="font-mono">{origin.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Nombre</dt>
              <dd>{origin.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Categoría</dt>
              <dd>{CATEGORY_LABELS[origin.category]}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Procedencia padre</dt>
              <dd>
                {origin.parent ? (
                  <Link
                    href={`/laboratory/origins/${origin.parent.id}`}
                    className="text-primary hover:underline"
                  >
                    {origin.parent.code} — {origin.parent.name}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Días recepción</dt>
              <dd>{origin.receptionDays ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Horario recepción</dt>
              <dd>{origin.receptionSchedule ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Modo recepción</dt>
              <dd>{RECEPTION_MODE_LABELS[origin.sampleReceptionMode]}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Métodos de entrega</dt>
              <dd className="flex gap-1.5 flex-wrap mt-1">
                {origin.reportDeliveryMethods?.length ? (
                  origin.reportDeliveryMethods.map((m) => (
                    <Badge key={m} variant="outline">
                      {DELIVERY_METHOD_LABELS[m]}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            {origin.notes && (
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Notas</dt>
                <dd className="whitespace-pre-wrap">{origin.notes}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dirección</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Calle</dt>
              <dd>{joinAddress(origin)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Comuna</dt>
              <dd>{origin.commune ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ciudad</dt>
              <dd>{origin.city ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Teléfono</dt>
              <dd>
                {origin.phone ? (
                  <a href={`tel:${origin.phone}`} className="text-primary hover:underline">
                    {origin.phone}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Email</dt>
              <dd>
                {origin.email ? (
                  <a href={`mailto:${origin.email}`} className="text-primary hover:underline">
                    {origin.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plazos de entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Biopsia</dt>
              <dd>{origin.deliveryDaysBiopsy ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PAP</dt>
              <dd>{origin.deliveryDaysPap ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Citología</dt>
              <dd>{origin.deliveryDaysCytology ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">IHQ</dt>
              <dd>{origin.deliveryDaysIhc ?? "—"} días</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Por defecto</dt>
              <dd>{origin.deliveryDaysDefault ?? "—"} días</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {origin.hasFtpHost && (
        <Card>
          <Collapsible>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="cursor-pointer hover:bg-muted/40">
                <CardTitle className="flex items-center justify-between">
                  Configuración FTP
                  <Badge variant="outline">Configurado</Badge>
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Host</dt>
                    <dd className="font-mono">***</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Usuario</dt>
                    <dd className="font-mono">{origin.hasFtpUser ? "***" : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Contraseña</dt>
                    <dd className="font-mono">{origin.hasFtpPassword ? "***" : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Ruta</dt>
                    <dd className="font-mono">{origin.ftpPath ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notificaciones críticas</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Emails</dt>
              <dd>
                {origin.criticalNotificationEmails?.length ? (
                  <ul className="mt-1 space-y-0.5">
                    {origin.criticalNotificationEmails.map((e) => (
                      <li key={e}>
                        <a href={`mailto:${e}`} className="text-primary hover:underline">
                          {e}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Recibe reportes de calidad</dt>
              <dd>{origin.sendsQualityReports ? "Sí" : "No"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vinculación</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Cliente (persona jurídica)</dt>
              <dd>
                {origin.legalEntity ? (
                  <Link
                    href={`/clients/${origin.legalEntity.id}`}
                    className="text-primary hover:underline"
                  >
                    {origin.legalEntity.legalName}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Convenio</dt>
              <dd>
                {origin.billingAgreement ? (
                  <Link
                    href={`/collections/agreements/${origin.billingAgreement.id}`}
                    className="text-primary hover:underline"
                  >
                    <span className="font-mono">{origin.billingAgreement.code}</span> —{" "}
                    {origin.billingAgreement.name}{" "}
                    <Badge
                      variant={STATUS_BADGE_VARIANT[origin.billingAgreement.status]}
                      className="ml-1"
                    >
                      {STATUS_LABELS[origin.billingAgreement.status]}
                    </Badge>
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {origin.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Subprocedencias ({origin.children.length})</CardTitle>
          </CardHeader>
          <CardContent>
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
                  {origin.children.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b last:border-0 cursor-pointer hover:bg-muted/40"
                      onClick={() => router.push(`/laboratory/origins/${c.id}`)}
                    >
                      <td className="py-2 px-3 font-mono">{c.code}</td>
                      <td className="py-2 px-3">{c.name}</td>
                      <td className="py-2 px-3">
                        <Badge variant="secondary">{CATEGORY_LABELS[c.category]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
