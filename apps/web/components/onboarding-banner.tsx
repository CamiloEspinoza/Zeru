"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";

const DISMISSED_KEY = "onboarding_banner_dismissed";

interface OnboardingStatus {
  completed: boolean;
  steps: {
    aiConfigured: boolean;
    storageConfigured: boolean;
  };
}

export function OnboardingBanner() {
  const [visible, setVisible] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    api
      .get<OnboardingStatus>("/tenants/current/onboarding-status")
      .then((status) => {
        const items: string[] = [];
        if (!status.steps.aiConfigured) items.push("ai");
        if (!status.steps.storageConfigured) items.push("storage");
        if (items.length > 0) {
          setMissing(items);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  };

  return (
    <div className="relative rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-3 top-3 text-amber-400 hover:text-amber-600 dark:hover:text-amber-100"
        aria-label="Cerrar"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-start gap-3 pr-6">
        <svg
          className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
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
          <p className="font-medium">
            Completa la configuración para habilitar todas las funciones
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-0.5">
            {missing.includes("ai") && (
              <li>
                <Link
                  href="/settings/ai"
                  className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Configurar Asistente IA (OpenAI API key)
                </Link>
              </li>
            )}
            {missing.includes("storage") && (
              <li>
                <Link
                  href="/settings/storage"
                  className="underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-100"
                >
                  Configurar Almacenamiento (AWS S3)
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
