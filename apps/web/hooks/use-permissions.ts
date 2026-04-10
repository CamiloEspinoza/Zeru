"use client";

import { useState, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";
import {
  canAccessModule,
  hasPermission,
  type AccessLevel,
  type ModuleAccessEntry,
  type PermissionOverrideEntry,
} from "@zeru/shared";

interface RoleInfo {
  id: string;
  name: string;
  slug: string;
}

interface PermissionsData {
  role: RoleInfo;
  moduleAccess: ModuleAccessEntry[];
  overrides: PermissionOverrideEntry[];
}

let permissionsCache: PermissionsData | null = null;
let permissionsPromise: Promise<PermissionsData> | null = null;

function fetchPermissions(): Promise<PermissionsData> {
  if (!permissionsPromise) {
    permissionsPromise = api
      .get<PermissionsData>("/auth/my-permissions")
      .then((res) => {
        permissionsCache = res;
        return res;
      })
      .finally(() => {
        permissionsPromise = null;
      });
  }
  return permissionsPromise;
}

export function usePermissions() {
  const [data, setData] = useState<PermissionsData | null>(permissionsCache);
  const [loading, setLoading] = useState(!permissionsCache);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef<true | null>(null);

  if (initialized.current == null) {
    initialized.current = true;
    if (!permissionsCache) {
      fetchPermissions()
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((err) => {
          setError(
            err instanceof Error ? err.message : "Error loading permissions",
          );
          setData(null);
        })
        .finally(() => setLoading(false));
    }
  }

  const refetch = useCallback(() => {
    setLoading(true);
    permissionsCache = null;
    fetchPermissions()
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Error loading permissions",
        );
        setData(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const can = useCallback(
    (moduleKey: string, action: string): boolean => {
      if (!data) return false;
      return hasPermission(
        data.moduleAccess,
        data.overrides,
        moduleKey,
        action,
      );
    },
    [data],
  );

  const canAccess = useCallback(
    (moduleKey: string): boolean => {
      if (!data) return false;
      return canAccessModule(data.moduleAccess, moduleKey);
    },
    [data],
  );

  const getModuleLevel = useCallback(
    (moduleKey: string): AccessLevel => {
      if (!data) return "NONE";
      const entry = data.moduleAccess.find((a) => a.moduleKey === moduleKey);
      return entry?.accessLevel ?? "NONE";
    },
    [data],
  );

  return {
    role: data?.role ?? null,
    moduleAccess: data?.moduleAccess ?? [],
    overrides: data?.overrides ?? [],
    loading,
    error,
    can,
    canAccess,
    getModuleLevel,
    refetch,
  };
}
