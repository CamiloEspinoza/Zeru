"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api-client";
import { AI_MODELS, type AiProvider } from "@zeru/shared";
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
import { cn } from "@/lib/utils";

interface AiConfig {
  provider?: AiProvider;
  model?: string;
  isActive?: boolean;
  hasApiKey?: boolean;
}

type KeyStatus = "idle" | "validating" | "valid" | "invalid";
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

export default function AiSettingsPage() {
  const [config, setConfig] = useState<AiConfig>({});
  const [loading, setLoading] = useState(true);
  const [showApiKey, setShowApiKey] = useState(false);

  const [provider, setProvider] = useState<AiProvider>("OPENAI");
  const [model, setModel] = useState("gpt-5.2-2025-12-11");
  const [apiKey, setApiKey] = useState("");
  const [keyStatus, setKeyStatus] = useState<KeyStatus>("idle");
  const [keyError, setKeyError] = useState("");

  const [providerSave, setProviderSave] = useState<SaveStatus>("idle");
  const [modelSave, setModelSave] = useState<SaveStatus>("idle");
  const [keySave, setKeySave] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    api
      .get<AiConfig>("/ai/config")
      .then((data) => {
        setConfig(data);
        if (data.provider) setProvider(data.provider);
        if (data.model) setModel(data.model);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const flashSaved = (
    setter: (s: SaveStatus) => void,
    key: string,
  ) => {
    setter("saved");
    if (savedTimers.current[key]) clearTimeout(savedTimers.current[key]);
    savedTimers.current[key] = setTimeout(() => setter("idle"), 2500);
  };

  const autoSave = useCallback(
    async (
      opts: {
        provider: AiProvider;
        model: string;
        apiKey: string;
        setStatus: (s: SaveStatus) => void;
        statusKey: string;
      },
    ) => {
      const { setStatus, statusKey } = opts;
      setStatus("saving");
      setSaveError("");
      try {
        const updated = await api.put<AiConfig>("/ai/config", {
          provider: opts.provider,
          apiKey: opts.apiKey || "KEEP_EXISTING",
          model: opts.model,
        });
        setConfig(updated);
        if (opts.apiKey) {
          setApiKey("");
          setKeyStatus("idle");
        }
        flashSaved(setStatus, statusKey);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al guardar";
        setSaveError(msg);
        setStatus("error");
        if (savedTimers.current[statusKey])
          clearTimeout(savedTimers.current[statusKey]);
        savedTimers.current[statusKey] = setTimeout(
          () => setStatus("idle"),
          4000,
        );
      }
    },
    [],
  );

  const handleProviderChange = (value: string) => {
    const newProvider = value as AiProvider;
    const newModel = AI_MODELS[newProvider]?.[0]?.id ?? "";
    setProvider(newProvider);
    setModel(newModel);
    setApiKey("");
    setKeyStatus("idle");
    setKeyError("");
    if (config.hasApiKey) {
      autoSave({
        provider: newProvider,
        model: newModel,
        apiKey: "",
        setStatus: setProviderSave,
        statusKey: "provider",
      });
    }
  };

  const handleModelChange = (value: string) => {
    setModel(value);
    if (config.hasApiKey) {
      autoSave({
        provider,
        model: value,
        apiKey: "",
        setStatus: setModelSave,
        statusKey: "model",
      });
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
    setKeyError("");
    setKeySave("idle");

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setKeyStatus("idle");
      return;
    }

    if (!value.trim().startsWith("sk-")) {
      setKeyStatus("invalid");
      setKeyError('Las API keys de OpenAI comienzan con "sk-"');
      return;
    }

    setKeyStatus("validating");

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.post<{ valid: boolean; error?: string }>(
          "/ai/config/validate-key",
          { provider, apiKey: value.trim() },
        );
        if (res.valid) {
          setKeyStatus("valid");
          setKeyError("");
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

  const handleApiKeyBlur = () => {
    if (keyStatus !== "valid") return;
    autoSave({
      provider,
      model,
      apiKey: apiKey.trim(),
      setStatus: setKeySave,
      statusKey: "key",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const models = AI_MODELS[provider] ?? [];
  const isKeyBusy = keyStatus === "validating";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Asistente IA</h1>
        <p className="text-muted-foreground mt-1">
          Configura el proveedor de inteligencia artificial para el contador
          virtual.
        </p>
      </div>

      {config.hasApiKey && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Proveedor configurado y activo
          <Badge variant="secondary" className="ml-auto">
            {config.provider}
          </Badge>
        </div>
      )}

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Proveedor</CardTitle>
            <CardDescription>
              Selecciona el servicio de IA que utilizará el asistente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="provider">Proveedor de IA</Label>
                <SaveIndicator status={providerSave} error={saveError} />
              </div>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger id="provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPENAI">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="model">Modelo</Label>
                <SaveIndicator status={modelSave} error={saveError} />
              </div>
              <Select value={model} onValueChange={handleModelChange}>
                <SelectTrigger id="model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Autenticación</CardTitle>
            <CardDescription>
              {config.hasApiKey
                ? "Ingresa una nueva API key para reemplazar la actual."
                : "Ingresa tu API key de OpenAI. Se almacena cifrada."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="apiKey">
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
                  id="apiKey"
                  type={showApiKey ? "text" : "password"}
                  placeholder={
                    config.hasApiKey
                      ? "sk-... (dejar vacío para no cambiar)"
                      : "sk-..."
                  }
                  value={apiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  onBlur={handleApiKeyBlur}
                  disabled={isKeyBusy || keySave === "saving"}
                  className={cn(
                    "pr-20 transition-colors",
                    keyStatus === "valid" &&
                      "border-green-500 focus-visible:ring-green-500",
                    keyStatus === "invalid" &&
                      "border-destructive focus-visible:ring-destructive",
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />

                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  {isKeyBusy || keySave === "saving" ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  ) : keyStatus === "valid" ? (
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
                  ) : keyStatus === "invalid" ? (
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
                <p className="text-xs text-muted-foreground">
                  Verificando conexión con OpenAI...
                </p>
              )}
              {keyStatus === "valid" && !isKeyBusy && keySave === "idle" && (
                <p className="text-xs text-muted-foreground">
                  API key válida — se guardará al salir del campo.
                </p>
              )}
              {keyStatus === "invalid" && keyError && !isKeyBusy && (
                <p className="text-xs text-destructive">{keyError}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
