"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { Tenant } from "@zeru/shared";
import { api } from "@/lib/api-client";
import { clearAuthCookie } from "@/lib/auth-cookies";

const TENANT_STORAGE_KEYS = ["tenantId", "tenant_id"];
const AUTH_STORAGE_KEYS = ["access_token", "refresh_token"];

function clearTenantFromStorage() {
  if (typeof window === "undefined") return;
  TENANT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function clearAuthFromStorage() {
  if (typeof window === "undefined") return;
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  clearAuthCookie();
}

export function useTenant() {
  const router = useRouter();
  const pathname = usePathname();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = localStorage.getItem("tenantId");

    // En rutas del dashboard sin tenantId: limpiar sesión y enviar a login
    const isDashboard = pathname?.startsWith("/dashboard") ?? false;
    if (isDashboard && !tenantId) {
      clearTenantFromStorage();
      clearAuthFromStorage();
      setLoading(false);
      router.replace("/login");
      return;
    }

    if (!tenantId) {
      setLoading(false);
      return;
    }

    api
      .get<Tenant>("/tenants/current", { tenantId })
      .then(setTenant)
      .catch(() => {
        setTenant(null);
        clearTenantFromStorage();
        clearAuthFromStorage();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router, pathname]);

  return { tenant, loading };
}
