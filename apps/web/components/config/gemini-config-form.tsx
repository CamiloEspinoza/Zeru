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
import { SaveIndicator, type SaveStatus } from "@/components/config/save-indicator";

interface GeminiConfig {
  hasApiKey?: boolean;
  isActive?: boolean;
}

type KeyStatus = "idle" | "validating" | "valid" | "invalid";

interface GeminiConfigFormProps {
  onConfigured?: () => void;
  showDeleteAction?: boolean;
}

export function GeminiConfigForm({
  onConfigured,
  showDeleteAction = true,
}: GeminiConfigFormProps) {
  const [config, setConfig] = useState<GeminiConfig>({});
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [keyError, setKeyError] = useState("");

  const [keySave, setKeySave] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api
      .get<GeminiConfig>("/ai/gemini-config")
      .then((data) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flashSaved = useCallback((setter: (s: SaveStatus) => void, key: string) => {
    setter("saved");
    if (savedTimers.current[key]) clearTimeout(savedTimers.current[key]);
    savedTimers.current[key] = setTimeout(() => setter("idle"), 2500);
  }, []);

  const saveKey = useCallback(
    async (key: string) => {
      setKeySave("saving");
      setSaveError("");
      try {
        const updated = await api.put<GeminiConfig>("/ai/gemini-config", { apiKey: key });
        setConfig(updated);
        setApiKey("");
        setKeyStatus("idle");
        onConfigured?.();
        flashSaved(setKeySave, "key");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setSaveError(msg);
        setKeySave("error");
        savedTimers.current["key"] = setTimeout(() => setKeySave("idle"), 4000);
      }
    },
    [onConfigured, flashSaved],
  );

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setKeyError("");
    setKeySave("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setKeyStatus("idle");
      return;
    }

    setKeyStatus("validating");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post<{ valid: boolean; error?: string }>(
          "/ai/gemini-config/validate-key",
          { apiKey: value.trim() },
        );
        if (res.valid) {
          setKeyStatus("valid");
          setKeyError("");
          await saveKey(value.trim());
        } else {
          setKeyStatus("invalid");
          setKeyError(res.error ?? "API key inválida");
        }
      } catch {
        setKeyStatus("invalid");
        setKeyError("No se pudo verificar la API key");
      }
    }, 800);
  };

  const handleDeleteKey = async () => {
    setDeleting(true);
    try {
      await api.delete("/ai/gemini-config/key");
      setConfig({});
      setApiKey("");
      setKeyStatus("idle");
      setKeyError("");
      setKeySave("idle");
    } catch {
      setSaveError("No se pudo eliminar la API key");
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

  const isKeyBusy = keyStatus === "validating";

  return (
    <div className="space-y-5">
      {config.hasApiKey && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          API key de Gemini configurada y activa
          <Badge variant="secondary" className="ml-auto">
            Google Gemini
          </Badge>
        </div>
      )}

      {/* Info card */}
      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2">
        <p className="text-sm font-medium">¿Para qué se usa?</p>
        <p className="text-sm text-muted-foreground">
          La API key de Gemini se usa para generar imágenes en los posts de LinkedIn mediante los modelos{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Gemini 3.1 Flash</span> y{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Gemini 3 Pro</span>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />
            Flash — ~$0.0672 / imagen
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
            Pro — ~$0.134 / imagen
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">API Key de Google Gemini</CardTitle>
              <CardDescription className="mt-1">
                {config.hasApiKey
                  ? "Ingresa una nueva API key para reemplazar la actual."
                  : "Obtén tu API key en Google AI Studio. Se almacena cifrada."}
              </CardDescription>
            </div>
            {showDeleteAction && config.hasApiKey && (
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
                    Eliminar key
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar API key de Gemini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se eliminará la API key almacenada. La generación de imágenes dejará de funcionar hasta que configures una nueva key.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteKey}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="geminiApiKey">
                API Key{" "}
                {config.hasApiKey && (
                  <span className="text-muted-foreground font-normal">
                    (dejar vacío para mantener la actual)
                  </span>
                )}
              </Label>
              <SaveIndicator status={keySave} error={saveError} />
            </div>

            <div className="relative">
              <Input
                id="geminiApiKey"
                type={showApiKey ? "text" : "password"}
                placeholder={
                  config.hasApiKey ? "AIza... (dejar vacío para no cambiar)" : "AIzaSy..."
                }
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                disabled={isKeyBusy || keySave === "saving"}
                className={cn(
                  "pr-20 transition-colors",
                  keyStatus === "valid" && "border-green-500 focus-visible:ring-green-500",
                  keyStatus === "invalid" && "border-destructive focus-visible:ring-destructive",
                )}
                autoComplete="off"
                spellCheck={false}
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {isKeyBusy || keySave === "saving" ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : keyStatus === "valid" ? (
                  <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : keyStatus === "invalid" ? (
                  <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showApiKey ? "Ocultar" : "Mostrar"}
                  </button>
                )}
              </div>
            </div>

            {isKeyBusy && (
              <p className="text-xs text-muted-foreground">Verificando conexión con Google Gemini...</p>
            )}
            {keyStatus === "valid" && !isKeyBusy && keySave === "idle" && (
              <p className="text-xs text-green-600 dark:text-green-400">API key válida</p>
            )}
            {keyStatus === "invalid" && keyError && !isKeyBusy && (
              <p className="text-xs text-destructive">{keyError}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => window.open("https://aistudio.google.com/apikey", "_blank", "noopener,noreferrer")}
      >
        <svg className="h-4 w-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        Obtener API key en Google AI Studio
      </Button>
    </div>
  );
}
