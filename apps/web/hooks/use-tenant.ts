"use client";

import { useEffect, useState } from "react";
import type { Tenant } from "@zeru/shared";
import { api } from "@/lib/api-client";

export function useTenant() {
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
      .catch(() => setTenant(null))
      .finally(() => setLoading(false));
  }, []);

  return { tenant, loading };
}
