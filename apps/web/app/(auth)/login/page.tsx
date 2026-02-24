"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema } from "@zeru/shared";
import type { AuthTokens, TenantSelectionRequired, UserRole } from "@zeru/shared";
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
  | { kind: "credentials" }
  | { kind: "pick-tenant"; tenants: Tenant[]; email: string; password: string };

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

// ─── Shared page shell ────────────────────────────────────────────────────────

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen flex items-center pt-16">
      <div className="relative max-w-6xl mx-auto w-full px-6 py-20 grid lg:grid-cols-2 gap-16 items-center">
        {children}
        <AuthCover />
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function storeTokens(tokens: AuthTokens) {
    localStorage.setItem("access_token", tokens.accessToken);
    setAuthCookie(tokens.accessToken);
    localStorage.setItem("refresh_token", tokens.refreshToken);
    if (tokens.tenantId) {
      localStorage.setItem("tenantId", tokens.tenantId);
    }
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<AuthTokens | TenantSelectionRequired>(
        "/auth/login",
        { email, password }
      );

      if ("requiresTenantSelection" in response) {
        setStep({ kind: "pick-tenant", tenants: response.tenants, email, password });
        return;
      }

      storeTokens(response as AuthTokens);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  async function handlePickTenant(tenantId: string) {
    if (step.kind !== "pick-tenant") return;
    setError(null);
    setLoading(true);
    try {
      const tokens = await api.post<AuthTokens>("/auth/login", {
        email: step.email,
        password: step.password,
        tenantId,
      });
      storeTokens(tokens);
      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al seleccionar organización"
      );
    } finally {
      setLoading(false);
    }
  }

  if (step.kind === "pick-tenant") {
    return (
      <AuthShell>
        <div className="flex flex-col gap-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white">Selecciona tu organización</h1>
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
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 px-4 py-3 text-left transition-all disabled:opacity-50"
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
            onClick={() => { setStep({ kind: "credentials" }); setError(null); }}
            className="text-sm text-white/40 hover:text-white/70 underline-offset-4 hover:underline transition-colors"
          >
            ← Volver
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-8">
        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white">Iniciar sesión</h1>
          <p className="text-white/50 text-sm">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCredentials} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email" className="text-white/70">
                Email
              </FieldLabel>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={loading}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="password" className="text-white/70">
                Contraseña
              </FieldLabel>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60"
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <Field>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20"
              >
                {loading ? "Verificando..." : "Continuar"}
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
