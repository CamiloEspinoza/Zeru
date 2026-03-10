"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface LinkedInConnectionInfo {
  id?: string;
  personUrn?: string;
  profileName?: string | null;
  profileImage?: string | null;
  expiresAt?: string;
  isExpired?: boolean;
  connected?: boolean;
}

interface LinkedInConfig {
  id: string;
  autoPublish: boolean;
  defaultVisibility: string;
  contentPillars: string[] | null;
}

const DEFAULT_PILLARS = ["thought-leadership", "tips", "case-study", "industry-news", "behind-the-scenes"];

export default function LinkedInSettingsPage() {
  const [connection, setConnection] = useState<LinkedInConnectionInfo | null>(null);
  const [, setConfig] = useState<LinkedInConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);

  const [autoPublish, setAutoPublish] = useState(false);
  const [defaultVisibility, setDefaultVisibility] = useState("PUBLIC");
  const [pillarsInput, setPillarsInput] = useState("");
  const [contentPillars, setContentPillars] = useState<string[]>(DEFAULT_PILLARS);

  const [sessionCookieConfigured, setSessionCookieConfigured] = useState(false);
  const [liAtInput, setLiAtInput] = useState("");
  const [savingCookie, setSavingCookie] = useState(false);
  const [cookieSaved, setCookieSaved] = useState(false);
  const [showCookieInstructions, setShowCookieInstructions] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [conn, cfg, cookieStatus] = await Promise.all([
        api.get<LinkedInConnectionInfo>("/linkedin/connection"),
        api.get<LinkedInConfig>("/linkedin/config").catch(() => null),
        api.get<{ configured: boolean }>("/linkedin/session-cookie/status").catch(() => ({ configured: false })),
      ]);
      setConnection(conn);
      setSessionCookieConfigured(cookieStatus.configured);
      if (cfg) {
        setConfig(cfg);
        setAutoPublish(cfg.autoPublish);
        setDefaultVisibility(cfg.defaultVisibility);
        setContentPillars(cfg.contentPillars ?? DEFAULT_PILLARS);
      }
    } catch {
      setConnection(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { url } = await api.get<{ url: string }>("/linkedin/auth/url");
      window.location.href = url;
    } catch {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await api.delete("/linkedin/connection");
      setConnection({ connected: false });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const updated = await api.put<LinkedInConfig>("/linkedin/config", {
        autoPublish,
        defaultVisibility,
        contentPillars,
      });
      setConfig(updated);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSaveCookie = async () => {
    if (!liAtInput.trim()) return;
    setSavingCookie(true);
    try {
      await api.put("/linkedin/session-cookie", { liAtCookie: liAtInput.trim() });
      setSessionCookieConfigured(true);
      setLiAtInput("");
      setCookieSaved(true);
      setTimeout(() => setCookieSaved(false), 3000);
    } finally {
      setSavingCookie(false);
    }
  };

  const handleAddPillar = () => {
    const trimmed = pillarsInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !contentPillars.includes(trimmed)) {
      setContentPillars((prev) => [...prev, trimmed]);
      setPillarsInput("");
    }
  };

  const handleRemovePillar = (pillar: string) => {
    setContentPillars((prev) => prev.filter((p) => p !== pillar));
  };

  const isConnected = connection && (connection.connected !== false) && connection.personUrn;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="size-6 animate-spin rounded-full border-2 border-[#0A66C2] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold">LinkedIn</h1>
        <p className="text-sm text-muted-foreground mt-1">Conecta tu cuenta y configura el agente de contenido.</p>
      </div>

      {/* Connection card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0">
            <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
          </div>
          <div>
            <h2 className="font-medium text-base">Cuenta de LinkedIn</h2>
            <p className="text-xs text-muted-foreground">
              {isConnected
                ? `Conectado como ${connection.profileName ?? connection.personUrn}`
                : "No conectado"}
            </p>
          </div>
          {isConnected && (
            <span className={`ml-auto inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${connection?.isExpired ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"}`}>
              {connection?.isExpired ? "Token expirado" : "Activo"}
            </span>
          )}
        </div>

        {isConnected ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              Reconectar
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-lg border border-destructive/30 px-4 py-2 text-sm text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="flex items-center gap-2 rounded-lg bg-[#0A66C2] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#004182] transition-colors disabled:opacity-50"
          >
            {connecting ? (
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            )}
            Conectar con LinkedIn
          </button>
        )}
      </div>

      {/* Session cookie */}
      {isConnected && (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-medium text-base flex items-center gap-2">
                Cookie de sesión
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${sessionCookieConfigured ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`}>
                  {sessionCookieConfigured ? "Configurada" : "No configurada"}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Necesaria para hacer menciones clickeables a otras personas en los posts.
              </p>
            </div>
            <button
              onClick={() => setShowCookieInstructions((v) => !v)}
              className="shrink-0 text-xs text-primary underline-offset-2 hover:underline"
            >
              {showCookieInstructions ? "Ocultar instrucciones" : "¿Cómo obtenerla?"}
            </button>
          </div>

          {showCookieInstructions && (
            <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2 text-sm">
              <p className="font-medium text-foreground">Cómo obtener tu cookie <code className="bg-muted px-1 rounded text-xs">li_at</code>:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground text-xs leading-relaxed">
                <li>Abre <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">linkedin.com</a> en tu navegador y asegúrate de estar logueado</li>
                <li>Abre las DevTools: <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[10px]">F12</kbd> en Windows/Linux o <kbd className="bg-muted border border-border rounded px-1 py-0.5 text-[10px]">Cmd + Option + I</kbd> en Mac</li>
                <li>Ve a la pestaña <strong>Application</strong> (Chrome/Edge) o <strong>Storage</strong> (Firefox)</li>
                <li>En el panel izquierdo, expande <strong>Cookies</strong> → selecciona <code className="bg-muted px-1 rounded text-[10px]">https://www.linkedin.com</code></li>
                <li>Busca la fila con nombre <strong><code className="bg-muted px-1 rounded text-[10px]">li_at</code></strong> y copia el valor de la columna <strong>Value</strong></li>
                <li>Pega ese valor en el campo de abajo</li>
              </ol>
              <p className="text-xs text-muted-foreground pt-1">
                ⚠️ La cookie expira cuando cierras sesión en LinkedIn. Si las menciones dejan de funcionar, repite este proceso.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={liAtInput}
              onChange={(e) => setLiAtInput(e.target.value)}
              placeholder={sessionCookieConfigured ? "Pega nueva cookie para reemplazar la actual..." : "Pega aquí el valor de la cookie li_at..."}
              className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-ring font-mono"
            />
            <button
              onClick={handleSaveCookie}
              disabled={savingCookie || !liAtInput.trim()}
              className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingCookie ? "Guardando…" : cookieSaved ? "✓ Guardada" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {/* Agent Config */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-6">
        <div>
          <h2 className="font-medium text-base">Configuración del Agente</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Controla el comportamiento del agente de contenido.</p>
        </div>

        {/* Auto-publish */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Publicación automática</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Si está activado, el agente publica directamente sin pedir aprobación.
            </p>
          </div>
          <button
            onClick={() => setAutoPublish((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoPublish ? "bg-[#0A66C2]" : "bg-muted"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoPublish ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* Visibility */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Visibilidad por defecto</label>
          <select
            value={defaultVisibility}
            onChange={(e) => setDefaultVisibility(e.target.value)}
            className="text-sm rounded-lg border border-border bg-background px-3 py-2 w-full outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="PUBLIC">Público (todos en LinkedIn)</option>
            <option value="CONNECTIONS">Solo mis conexiones</option>
          </select>
        </div>

        {/* Content pillars */}
        <div>
          <label className="text-sm font-medium block mb-1.5">Pilares de contenido</label>
          <p className="text-xs text-muted-foreground mb-3">
            Define los temas de contenido para tu estrategia editorial.
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {contentPillars.map((pillar) => (
              <span
                key={pillar}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-xs"
              >
                {pillar}
                <button
                  onClick={() => handleRemovePillar(pillar)}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={pillarsInput}
              onChange={(e) => setPillarsInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPillar()}
              placeholder="Agregar pilar de contenido..."
              className="flex-1 text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-ring"
            />
            <button
              onClick={handleAddPillar}
              disabled={!pillarsInput.trim()}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          disabled={savingConfig}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {savingConfig ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
