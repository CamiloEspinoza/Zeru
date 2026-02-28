"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserProfile, AuthTokens } from "@zeru/shared";
import { api } from "@/lib/api-client";
import { clearAuthCookie, setAuthCookie } from "@/lib/auth-cookies";

export function storeTokens(tokens: AuthTokens) {
  localStorage.setItem("access_token", tokens.accessToken);
  setAuthCookie(tokens.accessToken);
  if (tokens.refreshToken) {
    localStorage.setItem("refresh_token", tokens.refreshToken);
  }
  if (tokens.tenantId) {
    localStorage.setItem("tenantId", tokens.tenantId);
  }
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const me = await api.get<UserProfile>("/auth/me");
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [fetchUser]);

  const login = async (credentials: { email: string; password: string }) => {
    const tokens = await api.post<AuthTokens>("/auth/login", credentials);
    storeTokens(tokens);
    await fetchUser();
  };

  const switchTenant = async (tenantId: string) => {
    const tokens = await api.post<AuthTokens>("/auth/switch-tenant", { tenantId });
    storeTokens(tokens);
    // Reload para que todos los providers y queries se reinicialicen con el nuevo tenant
    window.location.href = "/";
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("tenantId");
    clearAuthCookie();
    setUser(null);
  };

  return { user, loading, login, switchTenant, logout };
}
