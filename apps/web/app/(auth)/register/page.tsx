"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerSchema } from "@zeru/shared";
import type { AuthTokens } from "@zeru/shared";
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

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const registerResult = registerSchema.safeParse({
      firstName,
      lastName,
      email,
      password,
      tenantName,
    });

    if (!registerResult.success) {
      setError(registerResult.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    try {
      const response = await api.post<AuthTokens & { tenantId?: string }>(
        "/auth/register",
        registerResult.data,
      );
      localStorage.setItem("access_token", response.accessToken);
      setAuthCookie(response.accessToken);
      localStorage.setItem("refresh_token", response.refreshToken);
      if (response.tenantId) {
        localStorage.setItem("tenantId", response.tenantId);
      }
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cuenta");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left column — form */}
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
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">Crear cuenta</h1>
                  <p className="text-muted-foreground text-sm text-balance">
                    Registra tu organización en Zeru
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="firstName">Nombre</FieldLabel>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      autoComplete="given-name"
                      disabled={loading}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="lastName">Apellido</FieldLabel>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Pérez"
                      autoComplete="family-name"
                      disabled={loading}
                    />
                  </Field>
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
                    autoComplete="new-password"
                    disabled={loading}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="tenantName">
                    Nombre de organización
                  </FieldLabel>
                  <Input
                    id="tenantName"
                    type="text"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="Mi Empresa SpA"
                    disabled={loading}
                  />
                </Field>

                {error && <FieldError>{error}</FieldError>}

                <Field>
                  <Button type="submit" disabled={loading} className="w-full">
                    {loading ? "Creando cuenta..." : "Crear cuenta"}
                  </Button>
                  <FieldDescription className="text-center">
                    ¿Ya tienes cuenta?{" "}
                    <Link
                      href="/login"
                      className="underline underline-offset-4"
                    >
                      Inicia sesión
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>

      {/* Right column — decorative cover */}
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
    </div>
  );
}
