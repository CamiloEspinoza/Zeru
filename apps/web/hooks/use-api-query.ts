"use client";

import { useState, useCallback, useEffect } from "react";
import { api } from "@/lib/api-client";

interface UseApiQueryOptions<T> {
  enabled?: boolean;
  transform?: (raw: unknown) => T;
}

interface UseApiQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApiQuery<T>(
  url: string | null,
  opts?: UseApiQueryOptions<T>,
): UseApiQueryResult<T> {
  const { enabled = true, transform } = opts ?? {};

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!url || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const raw = await api.get<unknown>(url);
      setData(transform ? transform(raw) : (raw as T));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [url, enabled, transform]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, loading, error, refetch };
}
