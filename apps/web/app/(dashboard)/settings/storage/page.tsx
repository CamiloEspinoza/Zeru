"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const AWS_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "sa-east-1", label: "South America (São Paulo)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
  { value: "eu-west-2", label: "Europe (London)" },
  { value: "eu-central-1", label: "Europe (Frankfurt)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
];

interface StorageConfig {
  region?: string;
  isActive?: boolean;
  hasCredentials?: boolean;
  bucket?: string;
}

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";
type SaveStatus = "idle" | "saving" | "saved" | "error";

function SaveIndicator({ status, error }: { status: SaveStatus; error: string }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "text-xs transition-opacity",
        status === "saving" && "text-muted-foreground",
        status === "saved" && "text-green-600 dark:text-green-400",
        status === "error" && "text-destructive",
      )}
    >
      {status === "saving" && "Guardando..."}
      {status === "saved" && "Guardado"}
      {status === "error" && (error || "Error al guardar")}
    </span>
  );
}

export default function StorageSettingsPage() {
  const [config, setConfig] = useState<StorageConfig>({});
  const [loading, setLoading] = useState(true);

  const [region, setRegion] = useState("us-east-1");
  const [accessKeyId, setAccessKeyId] = useState("");
  const [secretAccessKey, setSecretAccessKey] = useState("");
  const [bucket, setBucket] = useState("");
  const [showSecret, setShowSecret] = useState(false);

  const [validationStatus, setValidationStatus] = useState<ValidationStatus>("idle");
  const [validationError, setValidationError] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api
      .get<StorageConfig>("/storage/config")
      .then((data) => {
        setConfig(data);
        if (data.region) setRegion(data.region);
        if (data.bucket) setBucket(data.bucket);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flashSaved = () => {
    setSaveStatus("saved");
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2500);
  };

  const validateAndSave = useCallback(
    (opts: { region: string; accessKeyId: string; secretAccessKey: string; bucket: string }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!opts.accessKeyId.trim() || !opts.secretAccessKey.trim() || !opts.bucket.trim()) {
        setValidationStatus("idle");
        return;
      }

      setValidationStatus("validating");
      setValidationError("");

      debounceRef.current = setTimeout(async () => {
        try {
          const res = await api.post<{ valid: boolean; error?: string }>(
            "/storage/config/validate",
            {
              region: opts.region,
              accessKeyId: opts.accessKeyId.trim(),
              secretAccessKey: opts.secretAccessKey.trim(),
              bucket: opts.bucket.trim(),
            },
          );

          if (res.valid) {
            setValidationStatus("valid");
            setValidationError("");

            // Auto-save
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
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : "Error al guardar";
              setSaveError(msg);
              setSaveStatus("error");
              if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
              savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 4000);
            }
          } else {
            setValidationStatus("invalid");
            setValidationError(res.error ?? "Credenciales inválidas");
          }
        } catch {
          setValidationStatus("invalid");
          setValidationError("No se pudo verificar las credenciales");
        }
      }, 800);
    },
    [],
  );

  const triggerValidation = (overrides: Partial<{
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
  }> = {}) => {
    const vals = {
      region: overrides.region ?? region,
      accessKeyId: overrides.accessKeyId ?? accessKeyId,
      secretAccessKey: overrides.secretAccessKey ?? secretAccessKey,
      bucket: overrides.bucket ?? bucket,
    };
    validateAndSave(vals);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete("/storage/config");
      setConfig({});
      setAccessKeyId("");
      setSecretAccessKey("");
      setBucket("");
      setRegion("us-east-1");
      setValidationStatus("idle");
      setValidationError("");
      setSaveStatus("idle");
    } catch {
      setSaveError("No se pudo eliminar la configuración");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isBusy = validationStatus === "validating" || saveStatus === "saving";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Almacenamiento</h1>
        <p className="text-muted-foreground mt-1">
          Configura las credenciales de Amazon S3 para almacenar documentos de
          tu organización.
        </p>
      </div>

      {config.hasCredentials && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Almacenamiento configurado y activo
          <Badge variant="secondary" className="ml-auto">
            {config.region}
          </Badge>
        </div>
      )}

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Región</CardTitle>
            <CardDescription>
              Selecciona la región de AWS donde se encuentra tu bucket S3.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="region">Región AWS</Label>
              <Select
                value={region}
                onValueChange={(value) => {
                  setRegion(value);
                  if (accessKeyId && secretAccessKey && bucket) {
                    triggerValidation({ region: value });
                  }
                }}
              >
                <SelectTrigger id="region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AWS_REGIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                  {config.hasCredentials
                    ? "Ingresa nuevas credenciales para reemplazar las actuales."
                    : "Ingresa tus credenciales de AWS IAM. Se almacenan cifradas."}
                </CardDescription>
              </div>
              {config.hasCredentials && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleting}
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      {deleting ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                      Eliminar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar configuración de almacenamiento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminarán las credenciales almacenadas. No podrás subir ni descargar
                        documentos hasta que configures nuevas credenciales.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accessKeyId">
                Access Key ID{" "}
                {config.hasCredentials && (
                  <span className="text-muted-foreground font-normal">
                    (dejar vacío para mantener la actual)
                  </span>
                )}
              </Label>
              <Input
                id="accessKeyId"
                type="text"
                placeholder={config.hasCredentials ? "AKIA... (dejar vacío para no cambiar)" : "AKIA..."}
                value={accessKeyId}
                onChange={(e) => {
                  setAccessKeyId(e.target.value);
                  if (e.target.value && secretAccessKey && bucket) {
                    triggerValidation({ accessKeyId: e.target.value });
                  }
                }}
                disabled={isBusy}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="secretAccessKey">Secret Access Key</Label>
              <div className="relative">
                <Input
                  id="secretAccessKey"
                  type={showSecret ? "text" : "password"}
                  placeholder={config.hasCredentials ? "(dejar vacío para no cambiar)" : "Tu secret access key"}
                  value={secretAccessKey}
                  onChange={(e) => {
                    setSecretAccessKey(e.target.value);
                    if (accessKeyId && e.target.value && bucket) {
                      triggerValidation({ secretAccessKey: e.target.value });
                    }
                  }}
                  disabled={isBusy}
                  className="pr-16"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showSecret ? "Ocultar" : "Mostrar"}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bucket</CardTitle>
            <CardDescription>
              Nombre del bucket S3 donde se almacenarán los documentos.
            </CardDescription>
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
                  onChange={(e) => {
                    setBucket(e.target.value);
                    if (accessKeyId && secretAccessKey && e.target.value) {
                      triggerValidation({ bucket: e.target.value });
                    }
                  }}
                  disabled={isBusy}
                  className={cn(
                    "pr-10 transition-colors",
                    validationStatus === "valid" &&
                      "border-green-500 focus-visible:ring-green-500",
                    validationStatus === "invalid" &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isBusy ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : validationStatus === "valid" ? (
                    <svg
                      className="h-4 w-4 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : validationStatus === "invalid" ? (
                    <svg
                      className="h-4 w-4 text-destructive"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : null}
                </div>
              </div>

              {validationStatus === "validating" && (
                <p className="text-xs text-muted-foreground">
                  Verificando credenciales y bucket...
                </p>
              )}
              {validationStatus === "valid" && saveStatus === "idle" && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Credenciales válidas — bucket accesible
                </p>
              )}
              {validationStatus === "invalid" && validationError && (
                <p className="text-xs text-destructive">{validationError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
