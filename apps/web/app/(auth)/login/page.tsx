"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AuthTokens,
  SendCodeResponse,
  TenantSelectionRequired,
  UserRole,
} from "@zeru/shared";
import { api } from "@/lib/api-client";
import { setAuthCookie } from "@/lib/auth-cookies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { AuthCover } from "@/components/auth/auth-cover";

type Tenant = TenantSelectionRequired["tenants"][number];

type Step =
  | { kind: "email" }
  | { kind: "code"; email: string; expiresAt: string }
  | { kind: "pick-tenant"; tenants: Tenant[]; email: string; code: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OrgBadge({ role }: { role: UserRole }) {
  const labels: Record<UserRole, string> = {
    OWNER: "Propietario",
    ADMIN: "Admin",
    ACCOUNTANT: "Contador",
    VIEWER: "Lectura",
  };
  return (
    <span className="text-xs text-white/40 border border-white/10 rounded px-1.5 py-0.5">
      {labels[role] ?? role}
    </span>
  );
}

function storeTokens(tokens: AuthTokens) {
  localStorage.setItem("access_token", tokens.accessToken);
  setAuthCookie(tokens.accessToken);
  localStorage.setItem("refresh_token", tokens.refreshToken);
  if (tokens.tenantId) {
    localStorage.setItem("tenantId", tokens.tenantId);
  }
}

/** Countdown hook — returns remaining seconds. */
function useCountdown(expiresAt: string | null) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;
    function tick() {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt!).getTime() - Date.now()) / 1000),
      );
      setRemaining(diff);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

// ─── Layout shell ─────────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-[100dvh] flex items-center justify-center py-12 sm:pt-16">
      <div className="relative max-w-6xl mx-auto w-full px-5 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {children}
        <AuthCover />
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "email" });
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Request code ──────────────────────────────────────────────────

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Ingresa un email válido");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<SendCodeResponse>("/auth/send-code", {
        email: trimmed,
      });
      setStep({ kind: "code", email: trimmed, expiresAt: res.expiresAt });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar código");
    } finally {
      setLoading(false);
    }
  }

  // Auto-focus code input when entering code step
  useEffect(() => {
    if (step.kind === "code") {
      // Small delay to allow DOM to render
      requestAnimationFrame(() => codeInputRef.current?.focus());
    }
  }, [step.kind]);

  // ── Step 2: Verify code ───────────────────────────────────────────────────

  const handleVerifyCode = useCallback(
    async (codeValue: string, tenantId?: string) => {
      if (step.kind !== "code" && step.kind !== "pick-tenant") return;
      setError(null);
      setLoading(true);

      const emailForVerify =
        step.kind === "code" ? step.email : step.email;

      try {
        const res = await api.post<AuthTokens | TenantSelectionRequired>(
          "/auth/verify-code",
          { email: emailForVerify, code: codeValue, tenantId },
        );

        if ("requiresTenantSelection" in res) {
          setStep({
            kind: "pick-tenant",
            tenants: res.tenants,
            email: emailForVerify,
            code: codeValue,
          });
          return;
        }

        storeTokens(res as AuthTokens);
        router.push("/dashboard");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Código inválido o expirado",
        );
      } finally {
        setLoading(false);
      }
    },
    [step, router],
  );

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) {
      setError("El código debe tener 6 dígitos");
      return;
    }
    await handleVerifyCode(code);
  }

  // ── Step 3: Pick tenant ───────────────────────────────────────────────────

  async function handlePickTenant(tenantId: string) {
    if (step.kind !== "pick-tenant") return;
    await handleVerifyCode(step.code, tenantId);
  }

  // ── Resend code ───────────────────────────────────────────────────────────

  async function handleResend() {
    if (step.kind !== "code") return;
    setError(null);
    setLoading(true);
    try {
      const res = await api.post<SendCodeResponse>("/auth/send-code", {
        email: step.email,
      });
      setStep({ kind: "code", email: step.email, expiresAt: res.expiresAt });
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al reenviar código");
    } finally {
      setLoading(false);
    }
  }

  // ── Render: Tenant selection ──────────────────────────────────────────────

  if (step.kind === "pick-tenant") {
    return (
      <AuthShell>
        <div className="flex flex-col gap-6 sm:gap-8">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Selecciona tu organización
            </h1>
            <p className="text-white/50 text-sm">
              Tu cuenta pertenece a varias organizaciones
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {step.tenants.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={loading}
                onClick={() => handlePickTenant(t.id)}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 px-4 py-3.5 text-left transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-medium text-white">{t.name}</p>
                  <p className="text-xs text-white/40">{t.slug}</p>
                </div>
                <OrgBadge role={t.role} />
              </button>
            ))}
          </div>

          {error && (
            <p className="text-center text-sm text-red-400">{error}</p>
          )}

          <button
            type="button"
            onClick={() => {
              setStep({ kind: "email" });
              setError(null);
              setCode("");
            }}
            className="text-sm text-white/40 hover:text-white/70 underline-offset-4 hover:underline transition-colors"
          >
            &larr; Volver
          </button>
        </div>
      </AuthShell>
    );
  }

  // ── Render: Code verification ─────────────────────────────────────────────

  if (step.kind === "code") {
    return (
      <AuthShell>
        <CodeStep
          email={step.email}
          expiresAt={step.expiresAt}
          code={code}
          setCode={setCode}
          error={error}
          loading={loading}
          codeInputRef={codeInputRef}
          onSubmit={handleCodeSubmit}
          onResend={handleResend}
          onBack={() => {
            setStep({ kind: "email" });
            setError(null);
            setCode("");
          }}
        />
      </AuthShell>
    );
  }

  // ── Render: Email input (default) ─────────────────────────────────────────

  return (
    <AuthShell>
      <div className="flex flex-col gap-6 sm:gap-8">
        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Iniciar sesión
          </h1>
          <p className="text-white/50 text-sm">
            Te enviaremos un código de acceso a tu email
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSendCode} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email" className="text-white/70">
                Email
              </FieldLabel>
              <Input
                id="email"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
                disabled={loading}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60 h-12 text-base"
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <Field>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20 h-12 text-base active:scale-[0.98] transition-all"
              >
                {loading ? "Enviando..." : "Enviar código"}
              </Button>
              <FieldDescription className="text-center text-white/40">
                ¿No tienes cuenta?{" "}
                <Link
                  href="/register"
                  className="text-teal-400 hover:text-teal-300 underline-offset-4 hover:underline"
                >
                  Regístrate
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      </div>
    </AuthShell>
  );
}

// ─── Code step (extracted for clarity) ────────────────────────────────────────

function CodeStep({
  email,
  expiresAt,
  code,
  setCode,
  error,
  loading,
  codeInputRef,
  onSubmit,
  onResend,
  onBack,
}: {
  email: string;
  expiresAt: string;
  code: string;
  setCode: (v: string) => void;
  error: string | null;
  loading: boolean;
  codeInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: React.FormEvent) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const remaining = useCountdown(expiresAt);
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const expired = remaining <= 0;

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white">
          Revisa tu correo
        </h1>
        <p className="text-white/50 text-sm">
          Enviamos un código de 6 dígitos a{" "}
          <span className="text-white/70 font-medium">{email}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="code" className="text-white/70">
              Código de acceso
            </FieldLabel>
            <Input
              ref={codeInputRef}
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
              }}
              placeholder="000000"
              autoComplete="one-time-code"
              disabled={loading}
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60 h-14 text-center text-2xl tracking-[0.3em] font-mono"
            />
          </Field>

          {/* Timer */}
          <div className="text-center text-xs text-white/40">
            {expired ? (
              <span className="text-red-400">Código expirado</span>
            ) : (
              <>
                Expira en{" "}
                <span className="text-white/60 font-mono tabular-nums">
                  {minutes}:{String(seconds).padStart(2, "0")}
                </span>
              </>
            )}
          </div>

          {error && <FieldError>{error}</FieldError>}

          <Field>
            <Button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20 h-12 text-base active:scale-[0.98] transition-all disabled:opacity-40"
            >
              {loading ? "Verificando..." : "Verificar código"}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-white/40 hover:text-white/70 underline-offset-4 hover:underline transition-colors"
        >
          &larr; Cambiar email
        </button>
        <button
          type="button"
          onClick={onResend}
          disabled={loading}
          className="text-teal-400 hover:text-teal-300 underline-offset-4 hover:underline transition-colors disabled:opacity-40"
        >
          Reenviar código
        </button>
      </div>
    </div>
  );
}
