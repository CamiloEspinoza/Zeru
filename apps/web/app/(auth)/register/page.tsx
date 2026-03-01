"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { registerSchema } from "@zeru/shared";
import type { AuthTokens } from "@zeru/shared";
import { api } from "@/lib/api-client";
import { storeTokens } from "@/hooks/use-auth";
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

const REGISTER_TOKEN_KEY = "register_token";
const VALID_TOKEN = process.env.NEXT_PUBLIC_REGISTER_TOKEN ?? "";

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

// ─── Waitlist form ────────────────────────────────────────────────────────────

function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);
    try {
      await api.post("/auth/waitlist", { email });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al unirse a la lista"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Unirse a la lista</h1>
        <p className="text-white/50 text-sm">
          Te avisaremos cuando tu cupo esté listo
        </p>
      </div>

      {/* Alert */}
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <svg
            className="mt-0.5 size-4 shrink-0 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-400">
              Registros pausados temporalmente
            </p>
            <p className="text-xs text-white/40 leading-relaxed">
              Por ahora no estamos aceptando más registros. Déjanos tu email y
              te enviaremos un link de acceso en cuanto liberemos nuevos cupos.
            </p>
          </div>
        </div>
      </div>

      {success ? (
        <div className="rounded-xl border border-teal-500/25 bg-teal-500/8 px-4 py-6 text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-teal-500/15">
              <svg
                className="size-5 text-teal-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>
          <p className="text-sm font-medium text-white">¡Ya estás en la lista!</p>
          <p className="text-xs text-white/40">
            Te notificaremos a{" "}
            <span className="text-white/70 font-medium">{email}</span> cuando
            haya un cupo disponible.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="waitlist-email" className="text-white/70">
                Email
              </FieldLabel>
              <Input
                id="waitlist-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={loading}
                required
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60"
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}

            <Field>
              <Button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-teal-500 hover:bg-teal-400 text-white shadow-lg shadow-teal-500/20"
              >
                {loading ? "Enviando..." : "Notifícame cuando haya cupos"}
              </Button>
              <FieldDescription className="text-center text-white/40">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="text-teal-400 hover:text-teal-300 underline-offset-4 hover:underline"
                >
                  Inicia sesión
                </Link>
              </FieldDescription>
            </Field>
          </FieldGroup>
        </form>
      )}
    </div>
  );
}

// ─── Full register form ───────────────────────────────────────────────────────

function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const result = registerSchema.safeParse({
      firstName,
      lastName,
      email,
      tenantName,
    });

    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<AuthTokens & { tenantId?: string }>(
        "/auth/register",
        result.data
      );
      storeTokens(response);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">Crear cuenta</h1>
        <p className="text-white/50 text-sm">
          Registra tu organización en Zeru
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="firstName" className="text-white/70">
                Nombre
              </FieldLabel>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Juan"
                autoComplete="given-name"
                disabled={loading}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="lastName" className="text-white/70">
                Apellido
              </FieldLabel>
              <Input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Pérez"
                autoComplete="family-name"
                disabled={loading}
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-teal-500/60"
              />
            </Field>
          </div>

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
            <FieldLabel htmlFor="tenantName" className="text-white/70">
              Nombre de organización
            </FieldLabel>
            <Input
              id="tenantName"
              type="text"
              value={tenantName}
              onChange={(e) => setTenantName(e.target.value)}
              placeholder="Mi Empresa SpA"
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
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </Button>
            <FieldDescription className="text-center text-white/40">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-teal-400 hover:text-teal-300 underline-offset-4 hover:underline"
              >
                Inicia sesión
              </Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function RegisterPageContent() {
  const searchParams = useSearchParams();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);

  useEffect(() => {
    const urlToken = searchParams.get("token");
    const storedToken = localStorage.getItem(REGISTER_TOKEN_KEY);
    const token = urlToken ?? storedToken;
    const valid = Boolean(VALID_TOKEN && token === VALID_TOKEN);

    if (valid && urlToken) {
      localStorage.setItem(REGISTER_TOKEN_KEY, urlToken);
    }

    setHasAccess(valid);
  }, [searchParams]);

  if (hasAccess === null) return null;

  return (
    <AuthShell>
      {hasAccess ? <RegisterForm /> : <WaitlistForm />}
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterPageContent />
    </Suspense>
  );
}
