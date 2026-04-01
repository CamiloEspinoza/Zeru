"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { DailyCostResponse } from "@zeru/shared";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(210, 76%, 55%)",
  "hsl(280, 65%, 60%)",
  "hsl(30, 80%, 55%)",
];

interface CostTrendChartProps {
  data: DailyCostResponse | null | undefined;
  isLoading: boolean;
}

export function CostTrendChart({ data, isLoading }: CostTrendChartProps) {
  const { chartData, keys, chartConfig } = useMemo(() => {
    if (!data?.daily?.length) return { chartData: [], keys: [], chartConfig: {} as ChartConfig };

    const allKeys = new Set<string>();
    for (const day of data.daily) {
      for (const key of Object.keys(day.breakdown)) allKeys.add(key);
    }
    const sortedKeys = Array.from(allKeys);

    const config: ChartConfig = {};
    for (let i = 0; i < sortedKeys.length; i++) {
      config[sortedKeys[i]] = {
        label: sortedKeys[i],
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    }

    const transformed = data.daily.map((day) => ({
      date: new Date(day.date).toLocaleDateString("es-CL", {
        day: "2-digit",
        month: "short",
      }),
      ...day.breakdown,
    }));

    return { chartData: transformed, keys: sortedKeys, chartConfig: config };
  }, [data]);

  if (isLoading || !chartData.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tendencia Diaria</CardTitle>
          <CardDescription>Costos por feature desglosados por dia</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[350px] items-center justify-center text-muted-foreground">
          {isLoading ? "Cargando..." : "Sin datos para el periodo seleccionado"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia Diaria</CardTitle>
        <CardDescription>Costos por feature desglosados por dia</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) =>
                    typeof value === "number" ? `$${value.toFixed(4)}` : String(value)
                  }
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            {keys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="costs"
                fill={`var(--color-${key})`}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
