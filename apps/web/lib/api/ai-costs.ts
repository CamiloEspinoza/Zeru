import { api } from "@/lib/api-client";
import type {
  AiModelPricingDto,
  CostBreakdownResponse,
  CostSummaryResponse,
  DailyCostResponse,
} from "@zeru/shared";

// ── Query-string helpers ─────────────────────────────────────

function qs(params: Record<string, string | undefined>): string {
  const entries = Object.entries(params).filter(
    (pair): pair is [string, string] => pair[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries).toString();
}

export interface DateRangeParams {
  from?: string;
  to?: string;
}

// ── Tenant-scoped endpoints ──────────────────────────────────

export const aiCostsApi = {
  summary: (params: DateRangeParams) =>
    api.get<CostSummaryResponse>(`/ai/costs/summary${qs(params)}`),

  byFeature: (params: DateRangeParams) =>
    api.get<CostBreakdownResponse>(`/ai/costs/by-feature${qs(params)}`),

  byUser: (params: DateRangeParams) =>
    api.get<CostBreakdownResponse>(`/ai/costs/by-user${qs(params)}`),

  byModel: (params: DateRangeParams) =>
    api.get<CostBreakdownResponse>(`/ai/costs/by-model${qs(params)}`),

  daily: (params: DateRangeParams) =>
    api.get<DailyCostResponse>(`/ai/costs/daily${qs(params)}`),
};

// ── Global (superadmin) endpoints ────────────────────────────

export const aiCostsGlobalApi = {
  summary: (params: DateRangeParams) =>
    api.get<CostSummaryResponse>(`/ai/costs/global/summary${qs(params)}`),

  byTenant: (params: DateRangeParams) =>
    api.get<CostBreakdownResponse>(`/ai/costs/global/by-tenant${qs(params)}`),

  daily: (params: DateRangeParams) =>
    api.get<DailyCostResponse>(`/ai/costs/global/daily${qs(params)}`),
};

// ── Pricing endpoints ────────────────────────────────────────

export const aiPricingApi = {
  getActive: () => api.get<AiModelPricingDto[]>("/ai/pricing/active"),

  getAll: () => api.get<AiModelPricingDto[]>("/ai/pricing"),

  create: (body: Omit<AiModelPricingDto, "id">) =>
    api.post<AiModelPricingDto>("/ai/pricing", body),

  update: (id: string, body: Partial<AiModelPricingDto>) =>
    api.patch<AiModelPricingDto>(`/ai/pricing/${id}`, body),
};
