"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Tenant } from "@zeru/shared";
import { api } from "@/lib/api-client";

const TENANT_STORAGE_KEYS = ["tenantId", "tenant_id"];

function clearTenantFromStorage() {
  if (typeof window === "undefined") return;
  TENANT_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function useTenant() {
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tenantId = localStorage.getItem("tenantId");
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
        router.replace("/");
      })
      .finally(() => setLoading(false));
  }, [router]);

  return { tenant, loading };
}
