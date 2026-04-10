"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SaveIndicator } from "@/components/config/save-indicator";
import { ConfigStatusBanner } from "@/components/config/config-status-banner";
import { ConfigDeleteAction } from "@/components/config/config-delete-action";
import { SecretField } from "@/components/config/secret-field";
import { useConfigValidation } from "@/hooks/use-config-validation";
import { AWS_REGIONS } from "@/lib/aws-regions";
import { cn } from "@/lib/utils";

interface StorageConfig {
  region?: string;
  isActive?: boolean;
  hasCredentials?: boolean;
  bucket?: string;
}

interface StorageConfigFormProps {
  onConfigured?: () => void;
  showHeader?: boolean;
  showDeleteAction?: boolean;
  docsHref?: string;
}

export function StorageConfigForm({
  onConfigured,
  showHeader = true,
  showDeleteAction = true,
  docsHref,
}: StorageConfigFormProps) {
  const [config, setConfig] = useState<StorageConfig>({});
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");

  const { saveState: saveStatus, setSaveState: setSaveStatus, flashSaved, validationState: validationStatus, setValidationState: setValidationStatus, debouncedValidate } =
    useConfigValidation();

  useEffect(() => {
    api.get<StorageConfig>("/storage/config")
      .then((data) => { setConfig(data); if (data.region) setRegion(data.region); if (data.bucket) setBucket(data.bucket); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validateAndSave = useCallback(
    (opts: { region: string; accessKeyId: string; secretAccessKey: string; bucket: string }) => {
      const hasNewCreds = opts.accessKeyId.trim() && opts.secretAccessKey.trim();
      if ((!hasNewCreds && !config.hasCredentials) || !opts.bucket.trim()) {
        setValidationStatus("idle");
        return;
      }
      setValidationStatus("validating");
      setValidationError("");
      debouncedValidate(async () => {
        try {
          const res = await api.post<{ valid: boolean; error?: string }>("/storage/config/validate", {
            region: opts.region,
            accessKeyId: opts.accessKeyId.trim(),
            secretAccessKey: opts.secretAccessKey.trim(),
            bucket: opts.bucket.trim(),
          });
          if (res.valid) {
            setValidationStatus("valid");
            setSaveStatus("saving");
            setSaveError("");
            try {
              const updated = await api.put<StorageConfig>("/storage/config", {
                region: opts.region,
                accessKeyId: opts.accessKeyId.trim(),
                secretAccessKey: opts.secretAccessKey.trim(),
                bucket: opts.bucket.trim(),
              });
              setConfig(updated);
              setAccessKeyId("");
              setSecretAccessKey("");
              flashSaved();
              onConfigured?.();
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error al guardar";
              setSaveError(msg);
              setSaveStatus("error");
              flashSaved(setSaveStatus, "err");
            }
          } else {
            setValidationStatus("invalid");
            setValidationError(res.error ?? "Credenciales inválidas");
          }
        } catch {
          setValidationStatus("invalid");
          setValidationError("No se pudo verificar las credenciales");
        }
      });
    },
    [onConfigured, flashSaved, config.hasCredentials, setValidationStatus, setSaveStatus, debouncedValidate],
  );

  const triggerValidation = (overrides: Partial<{ region: string; accessKeyId: string; secretAccessKey: string; bucket: string }> = {}) => {
    validateAndSave({
      region: overrides.region ?? region,
      accessKeyId: overrides.accessKeyId ?? accessKeyId,
      secretAccessKey: overrides.secretAccessKey ?? secretAccessKey,
      bucket: overrides.bucket ?? bucket,
    });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const isBusy = validationStatus === "validating" || saveStatus === "saving";

  return (
    <div className="space-y-5">
      {config.hasCredentials && <ConfigStatusBanner label="Almacenamiento configurado y activo" badge={config.region} />}

      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="text-base">Región</CardTitle>
            <CardDescription>Selecciona la región de AWS donde se encuentra tu bucket S3.</CardDescription>
          </CardHeader>
        )}
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="region">Región AWS</Label>
            <Select value={region} onValueChange={(value) => { setRegion(value); if (accessKeyId && secretAccessKey && bucket) triggerValidation({ region: value }); }}>
              <SelectTrigger id="region"><SelectValue /></SelectTrigger>
              <SelectContent>{AWS_REGIONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Credenciales</CardTitle>
              <CardDescription className="mt-1">
                {config.hasCredentials ? "Ingresa nuevas credenciales para reemplazar las actuales." : "Ingresa tus credenciales de AWS IAM. Se almacenan cifradas."}
              </CardDescription>
            </div>
            {showDeleteAction && config.hasCredentials && (
              <ConfigDeleteAction
                title="¿Eliminar configuración de almacenamiento?"
                description="Se eliminarán las credenciales almacenadas. No podrás subir ni descargar documentos hasta que configures nuevas credenciales."
                onConfirm={async () => {
                  await api.delete("/storage/config");
                  setConfig({}); setAccessKeyId(""); setSecretAccessKey(""); setBucket(""); setRegion("us-east-1");
                  setValidationStatus("idle"); setValidationError(""); setSaveStatus("idle");
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="accessKeyId">
              Access Key ID{config.hasCredentials && <span className="text-muted-foreground font-normal"> (dejar vacío para mantener la actual)</span>}
            </Label>
            <Input
              id="accessKeyId"
              type="text"
              placeholder={config.hasCredentials ? "AKIA... (dejar vacío para no cambiar)" : "AKIA..."}
              value={accessKeyId}
              onChange={(e) => setAccessKeyId(e.target.value)}
              onBlur={() => { if (accessKeyId && secretAccessKey && bucket) triggerValidation({ accessKeyId }); }}
              disabled={isBusy}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secretAccessKey">Secret Access Key</Label>
            <SecretField
              id="secretAccessKey"
              value={secretAccessKey}
              onChange={(v) => setSecretAccessKey(v)}
              placeholder={config.hasCredentials ? "(dejar vacío para no cambiar)" : "Tu secret access key"}
              disabled={isBusy}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket</CardTitle>
          <CardDescription>Nombre del bucket S3 donde se almacenarán los documentos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="bucket">Nombre del bucket</Label>
              <SaveIndicator status={saveStatus} error={saveError} />
            </div>
            <div className="relative">
              <Input
                id="bucket"
                type="text"
                placeholder={config.bucket ?? "mi-bucket-s3"}
                value={bucket}
                onChange={(e) => setBucket(e.target.value)}
                onBlur={() => { if (bucket.trim() && (config.hasCredentials || (accessKeyId && secretAccessKey))) triggerValidation({ bucket }); }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted.trim()) setTimeout(() => triggerValidation({ bucket: pasted.trim() }), 0);
                }}
                disabled={isBusy}
                className={cn(
                  "pr-10 transition-colors",
                  validationStatus === "valid" && "border-green-500 focus-visible:ring-green-500",
                  validationStatus === "invalid" && "border-destructive focus-visible:ring-destructive",
                )}
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isBusy ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : validationStatus === "valid" ? (
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : validationStatus === "invalid" ? (
                  <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : null}
              </div>
            </div>
            {validationStatus === "validating" && <p className="text-xs text-muted-foreground">Verificando credenciales y bucket...</p>}
            {validationStatus === "valid" && saveStatus === "idle" && <p className="text-xs text-green-600 dark:text-green-400">Credenciales válidas — bucket accesible</p>}
            {validationStatus === "invalid" && validationError && <p className="text-xs text-destructive">{validationError}</p>}
          </div>
        </CardContent>
      </Card>

      {docsHref && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(docsHref, "_blank", "noopener,noreferrer")}>
          <svg className="h-4 w-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          ¿Cómo obtener las credenciales de AWS?
        </Button>
      )}
    </div>
  );
}
