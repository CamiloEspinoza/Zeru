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
    <span className="text-xs text-muted-foreground border rounded px-1.5 py-0.5">
      {labels[role] ?? role}
    </span>
  );
}

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
      const response = await api.post<
        AuthTokens | TenantSelectionRequired
      >("/auth/login", { email, password });

      if ("requiresTenantSelection" in response) {
        setStep({ kind: "pick-tenant", tenants: response.tenants, email, password });
        return;
      }

      storeTokens(response as AuthTokens);
      router.push("/");
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
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al seleccionar organización");
    } finally {
      setLoading(false);
    }
  }

  const cover = (
    <div className="bg-muted relative hidden lg:block">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl text-3xl font-bold shadow-lg">
          Z
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            Contabilidad inteligente
          </h2>
          <p className="text-muted-foreground max-w-sm text-sm text-balance">
            Zeru combina IA con contabilidad chilena para automatizar tus
            asientos, DTE y reportes tributarios.
          </p>
        </div>
      </div>
    </div>
  );

  if (step.kind === "pick-tenant") {
    return (
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
                Z
              </div>
              Zeru
            </Link>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-bold">Selecciona tu organización</h1>
                <p className="text-muted-foreground mt-1 text-sm text-balance">
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
                    className="flex items-center justify-between rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.slug}</p>
                    </div>
                    <OrgBadge role={t.role} />
                  </button>
                ))}
              </div>

              {error && <p className="text-center text-sm text-destructive">{error}</p>}

              <button
                type="button"
                onClick={() => { setStep({ kind: "credentials" }); setError(null); }}
                className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                ← Volver
              </button>
            </div>
          </div>
        </div>
        {cover}
      </div>
    );
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm font-bold">
              Z
            </div>
            Zeru
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <form onSubmit={handleCredentials} className="flex flex-col gap-6">
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Iniciar sesión</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Ingresa tus credenciales para continuar
                  </p>
                </div>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    autoComplete="email"
                    disabled={loading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                  />
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Verificando..." : "Continuar"}
                  </Button>
                  <FieldDescription className="text-center">
                    ¿No tienes cuenta?{" "}
                    <Link href="/register" className="underline underline-offset-4">
                      Regístrate
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
      {cover}
    </div>
  );
}
