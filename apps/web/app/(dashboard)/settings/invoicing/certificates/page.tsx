"use client";

import { useState, useEffect, useRef } from "react";
import { dteApi, type DteCertificate } from "@/lib/api/dte";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-CL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function statusBadge(cert: DteCertificate) {
  const days = daysUntil(cert.validUntil);

  if (cert.status === "REVOKED") {
    return <Badge variant="destructive">Revocado</Badge>;
  }
  if (cert.status === "EXPIRED" || days <= 0) {
    return <Badge variant="destructive">Expirado</Badge>;
  }
  if (days <= 30) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600">
        Expira en {days}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-500 text-green-600">
      Activo
    </Badge>
  );
}

export default function CertificatesPage() {
  const [certificates, setCertificates] = useState<DteCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [password, setPassword] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCertificates = () => {
    setLoading(true);
    dteApi
      .listCertificates()
      .then((data) => setCertificates(Array.isArray(data) ? data : []))
      .catch(() => setCertificates([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCertificates();
  }, []);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Seleccione un archivo .p12 o .pfx");
      return;
    }
    if (!password.trim()) {
      toast.error("Ingrese la contraseña del certificado");
      return;
    }

    setUploading(true);
    try {
      const isPrimary = certificates.length === 0;
      await dteApi.uploadCertificate(file, password, isPrimary);
      toast.success("Certificado subido correctamente");
      setPassword("");
      if (fileRef.current) fileRef.current.value = "";
      fetchCertificates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al subir certificado",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    setSettingPrimaryId(id);
    try {
      await dteApi.setPrimaryCertificate(id);
      toast.success("Certificado establecido como primario");
      fetchCertificates();
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Error al establecer certificado primario",
      );
    } finally {
      setSettingPrimaryId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await dteApi.deleteCertificate(id);
      toast.success("Certificado eliminado");
      fetchCertificates();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al eliminar certificado",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Certificados Digitales</h1>

      {/* ── Upload ── */}
      <Card>
        <CardHeader>
          <CardTitle>Subir certificado</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="cert-file">Archivo (.p12 / .pfx)</Label>
              <Input
                id="cert-file"
                type="file"
                accept=".p12,.pfx"
                ref={fileRef}
              />
            </div>
            <div className="w-64 space-y-2">
              <Label htmlFor="cert-password">Contraseña</Label>
              <Input
                id="cert-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña del .p12"
              />
            </div>
            <Button onClick={handleUpload} disabled={uploading}>
              {uploading ? "Subiendo..." : "Subir"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── List ── */}
      <Card>
        <CardHeader>
          <CardTitle>Certificados cargados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : certificates.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No hay certificados cargados
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titular</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Válido desde</TableHead>
                  <TableHead>Válido hasta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Primario</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certificates.map((cert) => {
                  const expiringSoon =
                    daysUntil(cert.validUntil) <= 30 &&
                    daysUntil(cert.validUntil) > 0;
                  return (
                    <TableRow
                      key={cert.id}
                      className={expiringSoon ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}
                    >
                      <TableCell className="font-medium">
                        {cert.subjectName}
                      </TableCell>
                      <TableCell>{cert.subjectRut}</TableCell>
                      <TableCell>{formatDate(cert.validFrom)}</TableCell>
                      <TableCell>{formatDate(cert.validUntil)}</TableCell>
                      <TableCell>{statusBadge(cert)}</TableCell>
                      <TableCell>
                        {cert.isPrimary ? (
                          <Badge>Primario</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={settingPrimaryId === cert.id}
                            onClick={() => handleSetPrimary(cert.id)}
                          >
                            {settingPrimaryId === cert.id
                              ? "Estableciendo..."
                              : "Usar como primario"}
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        {!cert.isPrimary && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={deletingId === cert.id}
                            onClick={() => handleDelete(cert.id)}
                          >
                            {deletingId === cert.id
                              ? "Eliminando..."
                              : "Eliminar"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
