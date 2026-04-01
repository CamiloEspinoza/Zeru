"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DailyCostResponse } from "@zeru/shared";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

interface CostTrendChartProps {
  data: DailyCostResponse | null | undefined;
  isLoading: boolean;
}

export function CostTrendChart({ data, isLoading }: CostTrendChartProps) {
  if (isLoading || !data?.daily?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendencia Diaria</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[350px] items-center justify-center text-muted-foreground">
          {isLoading
            ? "Cargando..."
            : "Sin datos para el periodo seleccionado"}
        </CardContent>
      </Card>
    );
  }

  const allKeys = new Set<string>();
  for (const day of data.daily) {
    for (const key of Object.keys(day.breakdown)) allKeys.add(key);
  }
  const keys = Array.from(allKeys);

  const chartData = data.daily.map((day) => ({
    date: new Date(day.date).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
    }),
    ...day.breakdown,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia Diaria</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <XAxis dataKey="date" fontSize={12} />
            <YAxis
              fontSize={12}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <Tooltip
              formatter={(value: number) => `$${value.toFixed(4)}`}
            />
            <Legend />
            {keys.map((key, i) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="a"
                fill={COLORS[i % COLORS.length]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
