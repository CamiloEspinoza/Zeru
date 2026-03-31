"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

interface CostKpiCardsProps {
  data:
    | {
        totalCostUsd: number;
        totalInputTokens: number;
        totalOutputTokens: number;
        totalCachedTokens: number;
      }
    | null
    | undefined;
  isLoading: boolean;
}

export function CostKpiCards({ data, isLoading }: CostKpiCardsProps) {
  const cards = [
    { title: "Costo Total", value: data ? formatUsd(data.totalCostUsd) : "-" },
    {
      title: "Input Tokens",
      value: data ? formatNumber(data.totalInputTokens) : "-",
    },
    {
      title: "Output Tokens",
      value: data ? formatNumber(data.totalOutputTokens) : "-",
    },
    {
      title: "Cache Tokens",
      value: data ? formatNumber(data.totalCachedTokens) : "-",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : card.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
