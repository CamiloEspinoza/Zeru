"use client";

import { useCallback } from "react";
import { useApiQuery } from "@/hooks/use-api-query";
import type {
  CostBreakdownResponse,
  CostSummaryResponse,
  DailyCostResponse,
  AiModelPricingDto,
} from "@zeru/shared";
import type { DateRangeParams } from "@/lib/api/ai-costs";

// ── Query-string helper ──────────────────────────────────────

function buildUrl(
  base: string,
  params: DateRangeParams,
): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] !== undefined,
  );
  if (entries.length === 0) return base;
  return base + "?" + new URLSearchParams(entries).toString();
}

// ── Tenant-scoped hooks ──────────────────────────────────────

export function useCostSummary(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/summary", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostSummaryResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useCostByFeature(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/by-feature", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostBreakdownResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useCostByUser(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/by-user", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostBreakdownResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useCostByModel(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/by-model", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostBreakdownResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useCostDaily(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/daily", params);
  const { data, loading, error, refetch } =
    useApiQuery<DailyCostResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

// ── Global (superadmin) hooks ────────────────────────────────

export function useGlobalCostSummary(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/global/summary", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostSummaryResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useGlobalCostByTenant(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/global/by-tenant", params);
  const { data, loading, error, refetch } =
    useApiQuery<CostBreakdownResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

export function useGlobalCostDaily(params: DateRangeParams) {
  const url = buildUrl("/ai/costs/global/daily", params);
  const { data, loading, error, refetch } =
    useApiQuery<DailyCostResponse>(url);
  return { data, isLoading: loading, error, refetch };
}

// ── Pricing hooks ────────────────────────────────────────────

export function useActivePricing() {
  const { data, loading, error, refetch } =
    useApiQuery<AiModelPricingDto[]>("/ai/pricing/active");
  return { data, isLoading: loading, error, refetch };
}

export function useAllPricing() {
  const transform = useCallback(
    (raw: unknown) => raw as AiModelPricingDto[],
    [],
  );
  const { data, loading, error, refetch } = useApiQuery<AiModelPricingDto[]>(
    "/ai/pricing",
    { transform },
  );
  return { data, isLoading: loading, error, refetch };
}
