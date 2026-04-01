"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SaveIndicator } from "@/components/config/save-indicator";
import { ConfigStatusBanner } from "@/components/config/config-status-banner";
import { ConfigDeleteAction } from "@/components/config/config-delete-action";
import { SecretField } from "@/components/config/secret-field";
import { useConfigValidation } from "@/hooks/use-config-validation";

interface GeminiConfig {
  hasApiKey?: boolean;
  isActive?: boolean;
}

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
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [keySave, setKeySave] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const { flashSaved, validationState: keyStatus, setValidationState: setKeyStatus, debouncedValidate } =
    useConfigValidation();

  useEffect(() => {
    api.get<GeminiConfig>("/ai/gemini-config")
      .then((data) => setConfig(data))
      .catch(() => {})
      .finally(() => setLoading(false));
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
        flashSaved(setKeySave, "key-err");
      }
    },
    [onConfigured, flashSaved, setKeyStatus],
  );

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setKeyError("");
    setKeySave("idle");
    if (!value.trim()) { setKeyStatus("idle"); return; }
    setKeyStatus("validating");
    debouncedValidate(async () => {
      try {
        const res = await api.post<{ valid: boolean; error?: string }>("/ai/gemini-config/validate-key", { apiKey: value.trim() });
        if (res.valid) { setKeyStatus("valid"); setKeyError(""); await saveKey(value.trim()); }
        else { setKeyStatus("invalid"); setKeyError(res.error ?? "API key inválida"); }
      } catch { setKeyStatus("invalid"); setKeyError("No se pudo verificar la API key"); }
    });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  return (
    <div className="space-y-5">
      {config.hasApiKey && <ConfigStatusBanner label="API key de Gemini configurada y activa" badge="Google Gemini" />}

      <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 space-y-2">
        <p className="text-sm font-medium">¿Para qué se usa?</p>
        <p className="text-sm text-muted-foreground">
          La API key de Gemini se usa para generar imágenes en los posts de LinkedIn mediante los modelos{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Gemini 3.1 Flash</span> y{" "}
          <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">Gemini 3 Pro</span>.
        </p>
        <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" />Flash — ~$0.0672 / imagen</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />Pro — ~$0.134 / imagen</span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">API Key de Google Gemini</CardTitle>
              <CardDescription className="mt-1">
                {config.hasApiKey ? "Ingresa una nueva API key para reemplazar la actual." : "Obtén tu API key en Google AI Studio. Se almacena cifrada."}
              </CardDescription>
            </div>
            {showDeleteAction && config.hasApiKey && (
              <ConfigDeleteAction
                title="¿Eliminar API key de Gemini?"
                description="Se eliminará la API key almacenada. La generación de imágenes dejará de funcionar hasta que configures una nueva key."
                buttonLabel="Eliminar key"
                onConfirm={async () => {
                  await api.delete("/ai/gemini-config/key");
                  setConfig({}); setApiKey(""); setKeyStatus("idle"); setKeyError(""); setKeySave("idle");
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="geminiApiKey">
                API Key{config.hasApiKey && <span className="text-muted-foreground font-normal"> (dejar vacío para mantener la actual)</span>}
              </Label>
              <SaveIndicator status={keySave} error={saveError} />
            </div>
            <SecretField
              id="geminiApiKey"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={config.hasApiKey ? "AIza... (dejar vacío para no cambiar)" : "AIzaSy..."}
              validationStatus={keyStatus}
              isSaving={keySave === "saving"}
            />
            {keyStatus === "validating" && <p className="text-xs text-muted-foreground">Verificando conexión con Google Gemini...</p>}
            {keyStatus === "valid" && keySave === "idle" && <p className="text-xs text-green-600 dark:text-green-400">API key válida</p>}
            {keyStatus === "invalid" && keyError && <p className="text-xs text-destructive">{keyError}</p>}
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
