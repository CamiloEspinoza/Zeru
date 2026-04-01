"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import {
  AI_MODELS,
  REASONING_EFFORT_OPTIONS,
  type AiProvider,
  type ReasoningEffort,
} from "@zeru/shared";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SaveIndicator, type SaveStatus } from "@/components/config/save-indicator";
import { ConfigStatusBanner } from "@/components/config/config-status-banner";
import { ConfigDeleteAction } from "@/components/config/config-delete-action";
import { SecretField } from "@/components/config/secret-field";
import { useConfigValidation } from "@/hooks/use-config-validation";

interface AiConfig {
  provider?: AiProvider;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  isActive?: boolean;
  hasApiKey?: boolean;
}

interface AiConfigFormProps {
  onConfigured?: () => void;
  showHeader?: boolean;
  showDeleteAction?: boolean;
  docsHref?: string;
}

export function AiConfigForm({
  onConfigured,
  showHeader = true,
  showDeleteAction = true,
  docsHref,
}: AiConfigFormProps) {
  const [config, setConfig] = useState<AiConfig>({});
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [model, setModel] = useState("gpt-5.4");
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>("medium");
  const [apiKey, setApiKey] = useState("");
  const [keyError, setKeyError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [providerSave, setProviderSave] = useState<SaveStatus>("idle");
  const [modelSave, setModelSave] = useState<SaveStatus>("idle");
  const [reasoningSave, setReasoningSave] = useState<SaveStatus>("idle");
  const [keySave, setKeySave] = useState<SaveStatus>("idle");

  const { flashSaved, validationState: keyStatus, setValidationState: setKeyStatus, debouncedValidate } =
    useConfigValidation();

  useEffect(() => {
    api.get<AiConfig>("/ai/config")
      .then((data) => {
        setConfig(data);
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
        if (data.reasoningEffort) setReasoningEffort(data.reasoningEffort);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const autoSave = useCallback(
    async (opts: {
      provider: AiProvider; model: string; reasoningEffort: ReasoningEffort; apiKey: string;
      setStatus: (s: SaveStatus) => void; statusKey: string;
    }) => {
      const { setStatus, statusKey } = opts;
      setStatus("saving");
      setSaveError("");
      try {
        const updated = await api.put<AiConfig>("/ai/config", {
          provider: opts.provider, apiKey: opts.apiKey || "KEEP_EXISTING",
          model: opts.model, reasoningEffort: opts.reasoningEffort,
        });
        setConfig(updated);
        if (opts.apiKey) { setApiKey(""); setKeyStatus("idle"); onConfigured?.(); }
        flashSaved(setStatus, statusKey);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setSaveError(msg);
        setStatus("error");
        flashSaved(setStatus, statusKey + "-err");
      }
    },
    [onConfigured, flashSaved, setKeyStatus],
  );

  const handleProviderChange = (value: string) => {
    const newProvider = value as AiProvider;
    const firstModel = AI_MODELS[newProvider]?.[0];
    const newModel = firstModel?.id ?? "";
    const newEffort = firstModel?.defaultReasoningEffort ?? "medium";
    setProvider(newProvider); setModel(newModel); setReasoningEffort(newEffort);
    setApiKey(""); setKeyStatus("idle"); setKeyError("");
    if (config.hasApiKey) autoSave({ provider: newProvider, model: newModel, reasoningEffort: newEffort, apiKey: "", setStatus: setProviderSave, statusKey: "provider" });
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    const newEffort = models.find((m) => m.id === value)?.defaultReasoningEffort ?? "medium";
    setReasoningEffort(newEffort);
    if (config.hasApiKey) autoSave({ provider, model: value, reasoningEffort: newEffort, apiKey: "", setStatus: setModelSave, statusKey: "model" });
  };

  const handleReasoningEffortChange = (value: string) => {
    const newEffort = value as ReasoningEffort;
    setReasoningEffort(newEffort);
    if (config.hasApiKey) autoSave({ provider, model, reasoningEffort: newEffort, apiKey: "", setStatus: setReasoningSave, statusKey: "reasoning" });
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value); setKeyError(""); setKeySave("idle");
    if (!value.trim()) { setKeyStatus("idle"); return; }
    if (!value.trim().startsWith("sk-")) {
      setKeyStatus("invalid");
      setKeyError('Las API keys de OpenAI comienzan con "sk-"');
      return;
    }
    setKeyStatus("validating");
    debouncedValidate(async () => {
      try {
        const res = await api.post<{ valid: boolean; error?: string }>("/ai/config/validate-key", { provider, apiKey: value.trim() });
        if (res.valid) {
          setKeyStatus("valid"); setKeyError("");
          autoSave({ provider, model, reasoningEffort, apiKey: value.trim(), setStatus: setKeySave, statusKey: "key" });
        } else { setKeyStatus("invalid"); setKeyError(res.error ?? "API key inválida"); }
      } catch { setKeyStatus("invalid"); setKeyError("No se pudo verificar la API key"); }
    });
  };

  if (loading) return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const models = AI_MODELS[provider] ?? [];
  const selectedModel = models.find((m) => m.id === model);
  const availableEfforts = REASONING_EFFORT_OPTIONS.filter((opt) => selectedModel?.supportedReasoningEfforts.includes(opt.id));

  return (
    <div className="space-y-5">
      {config.hasApiKey && <ConfigStatusBanner label="Proveedor configurado y activo" badge={config.provider} />}

      <Card>
        {showHeader && (
          <CardHeader>
            <CardTitle className="text-base">Proveedor</CardTitle>
            <CardDescription>Selecciona el servicio de IA que utilizará el asistente.</CardDescription>
          </CardHeader>
        )}
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="provider">Proveedor de IA</Label>
              <SaveIndicator status={providerSave} error={saveError} />
            </div>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger id="provider"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="OPENAI">OpenAI</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Modelo</Label>
              <SaveIndicator status={modelSave} error={saveError} />
            </div>
            <Select value={model} onValueChange={handleModelChange}>
              <SelectTrigger id="model"><SelectValue /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center gap-2">
                      <span>{m.label}</span>
                      <span className="text-muted-foreground text-xs">{m.contextWindow}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedModel && <p className="text-xs text-muted-foreground">{selectedModel.description}</p>}
          </div>
          {availableEfforts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="reasoningEffort">Nivel de razonamiento</Label>
                <SaveIndicator status={reasoningSave} error={saveError} />
              </div>
              <Select value={reasoningEffort} onValueChange={handleReasoningEffortChange}>
                <SelectTrigger id="reasoningEffort"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableEfforts.map((opt) => <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {REASONING_EFFORT_OPTIONS.find((o) => o.id === reasoningEffort) && (
                <p className="text-xs text-muted-foreground">
                  {REASONING_EFFORT_OPTIONS.find((o) => o.id === reasoningEffort)!.description}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-base">Autenticación</CardTitle>
              <CardDescription className="mt-1">
                {config.hasApiKey ? "Ingresa una nueva API key para reemplazar la actual." : "Ingresa tu API key de OpenAI. Se almacena cifrada."}
              </CardDescription>
            </div>
            {showDeleteAction && config.hasApiKey && (
              <ConfigDeleteAction
                title="¿Eliminar API key?"
                description="Se eliminará la API key almacenada. El asistente IA dejará de funcionar hasta que configures una nueva key."
                buttonLabel="Eliminar key"
                onConfirm={async () => {
                  await api.delete("/ai/config/key");
                  setConfig({}); setApiKey(""); setKeyStatus("idle"); setKeyError(""); setKeySave("idle");
                }}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="apiKey">
                API Key{config.hasApiKey && <span className="text-muted-foreground font-normal"> (dejar vacío para mantener la actual)</span>}
              </Label>
              <SaveIndicator status={keySave} error={saveError} />
            </div>
            <SecretField
              id="apiKey"
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder={config.hasApiKey ? "sk-... (dejar vacío para no cambiar)" : "sk-..."}
              validationStatus={keyStatus}
              isSaving={keySave === "saving"}
            />
            {keyStatus === "validating" && <p className="text-xs text-muted-foreground">Verificando conexión con OpenAI...</p>}
            {keyStatus === "valid" && keySave === "idle" && <p className="text-xs text-green-600 dark:text-green-400">API key válida</p>}
            {keyStatus === "invalid" && keyError && <p className="text-xs text-destructive">{keyError}</p>}
          </div>
        </CardContent>
      </Card>

      {docsHref && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => window.open(docsHref, "_blank", "noopener,noreferrer")}>
          <svg className="h-4 w-4 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          ¿Cómo obtener la API key?
        </Button>
      )}
    </div>
  );
}
