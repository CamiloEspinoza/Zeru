"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api-client";

export default function LinkedInOAuthRedirect() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const urlError = searchParams.get("error");

  const validationError = useMemo(() => {
    if (urlError) return searchParams.get("error_description") ?? "Autorización denegada por LinkedIn";
    if (!code || !state) return "Parámetros inválidos en la respuesta de LinkedIn";
    return null;
  }, [urlError, code, state, searchParams]);

  const [apiResult, setApiResult] = useState<{ status: "loading" | "success" | "error"; error: string }>({
    status: "loading",
    error: "",
  });

  useEffect(() => {
    if (validationError || !code || !state) return;

    const isCommunity = state.includes(":cm:");
    const endpoint = isCommunity ? "/linkedin/community/auth/callback" : "/linkedin/auth/callback";

    api
      .post(endpoint, { code, state })
      .then(() => {
        setApiResult({ status: "success", error: "" });
        setTimeout(() => router.replace("/settings/linkedin"), 1500);
      })
      .catch((err: unknown) => {
        setApiResult({
          status: "error",
          error: err instanceof Error ? err.message : "Error al conectar con LinkedIn",
        });
      });
  }, [validationError, code, state, router]);

  const status = validationError ? "error" : apiResult.status;
  const errorMessage = validationError ?? apiResult.error;

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
