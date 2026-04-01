"use client";

import { useState, useMemo } from "react";
import { CostKpiCards } from "@/components/ai/cost-kpi-cards";
import { CostTrendChart } from "@/components/ai/cost-trend-chart";
import { CostBreakdownTabs } from "@/components/ai/cost-breakdown-tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGlobalCostSummary,
  useGlobalCostByTenant,
  useGlobalCostDaily,
} from "@/hooks/use-ai-costs";

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  now.setSeconds(0, 0);
  const toStr = now.toISOString();
  switch (preset) {
    case "7d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString(), to: toStr };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: from.toISOString(), to: toStr };
    }
    case "prev-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { from: from.toISOString(), to: to.toISOString() };
    }
    default:
      return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to: toStr };
  }
}

export default function GlobalAiCostsPage() {
  const [preset, setPreset] = useState("month");
  const params = useMemo(() => getDateRange(preset), [preset]);

  const summary = useGlobalCostSummary(params);
  const byTenant = useGlobalCostByTenant(params);
  const daily = useGlobalCostDaily(params);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Costos de IA &mdash; Global</h1>
        <Select value={preset} onValueChange={setPreset}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Ultimos 7 dias</SelectItem>
            <SelectItem value="month">Mes actual</SelectItem>
            <SelectItem value="prev-month">Mes anterior</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CostKpiCards data={summary.data} isLoading={summary.isLoading} />
      <CostTrendChart data={daily.data} isLoading={daily.isLoading} />
      <CostBreakdownTabs
        byTenant={{ data: byTenant.data, isLoading: byTenant.isLoading }}
      />
    </div>
  );
}
