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
  "hsl(221, 83%, 53%)",  // blue
  "hsl(160, 84%, 39%)",  // emerald
  "hsl(271, 91%, 65%)",  // violet
  "hsl(25, 95%, 53%)",   // orange
  "hsl(346, 77%, 50%)",  // rose
  "hsl(45, 93%, 47%)",   // amber
  "hsl(192, 91%, 36%)",  // cyan
  "hsl(330, 81%, 60%)",  // pink
  "hsl(142, 71%, 45%)",  // green
  "hsl(15, 75%, 57%)",   // coral
  "hsl(199, 89%, 48%)",  // sky
  "hsl(280, 68%, 48%)",  // purple
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
                  formatter={(value, name) => (
                    <>
                      <div
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        style={{
                          backgroundColor:
                            chartConfig[name as string]?.color,
                        }}
                      />
                      <span className="text-muted-foreground">
                        {chartConfig[name as string]?.label ?? name}
                      </span>
                      <span className="ml-auto font-mono font-medium tabular-nums text-foreground">
                        {typeof value === "number"
                          ? `$${value.toFixed(4)}`
                          : String(value)}
                      </span>
                    </>
                  )}
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
