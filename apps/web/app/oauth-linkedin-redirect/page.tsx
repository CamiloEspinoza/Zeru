"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export default function LinkedInOAuthRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      setErrorMessage(searchParams.get("error_description") ?? "Autorización denegada por LinkedIn");
      setStatus("error");
      return;
    }

    if (!code || !state) {
      setErrorMessage("Parámetros inválidos en la respuesta de LinkedIn");
      setStatus("error");
      return;
    }

    api
      .post<{ personUrn: string; profileName?: string }>("/linkedin/auth/callback", { code, state })
      .then(() => {
        setStatus("success");
        setTimeout(() => router.replace("/linkedin"), 1500);
      })
      .catch((err: unknown) => {
        setErrorMessage(err instanceof Error ? err.message : "Error al conectar con LinkedIn");
        setStatus("error");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-auto px-6 text-center space-y-6">
        {status === "loading" && (
          <>
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-[#0A66C2]/10 flex items-center justify-center">
                <svg
                  className="h-6 w-6 animate-spin text-[#0A66C2]"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Conectando con LinkedIn...</p>
              <p className="text-sm text-muted-foreground mt-1">Verificando tu cuenta</p>
            </div>
          </>
        )}

        {status === "success" && (
          <>
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">LinkedIn conectado</p>
              <p className="text-sm text-muted-foreground mt-1">Redirigiendo al agente...</p>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <svg className="h-6 w-6 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <div>
              <p className="font-semibold text-foreground">Error al conectar</p>
              <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
            </div>
            <button
              onClick={() => router.replace("/settings/linkedin")}
              className="text-sm text-primary hover:underline"
            >
              Volver a configuración
            </button>
          </>
        )}
      </div>
    </div>
  );
}
