"use client";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CostBreakdownResponse } from "@zeru/shared";

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-CL").format(value);
}

interface BreakdownTableProps {
  data: CostBreakdownResponse | null | undefined;
  isLoading: boolean;
}

function BreakdownTable({ data, isLoading }: BreakdownTableProps) {
  if (isLoading)
    return (
      <div className="py-8 text-center text-muted-foreground">Cargando...</div>
    );
  if (!data?.breakdown?.length)
    return (
      <div className="py-8 text-center text-muted-foreground">Sin datos</div>
    );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead className="text-right">Costo USD</TableHead>
          <TableHead className="text-right">Input Tokens</TableHead>
          <TableHead className="text-right">Output Tokens</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="w-[120px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.breakdown.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right">{formatUsd(row.costUsd)}</TableCell>
            <TableCell className="text-right">
              {formatNumber(row.inputTokens)}
            </TableCell>
            <TableCell className="text-right">
              {formatNumber(row.outputTokens)}
            </TableCell>
            <TableCell className="text-right">
              {row.percentage.toFixed(1)}%
            </TableCell>
            <TableCell>
              <div className="h-2 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(row.percentage, 100)}%` }}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

type BreakdownSlot = { data: CostBreakdownResponse | null | undefined; isLoading: boolean };

interface CostBreakdownTabsProps {
  byFeature?: BreakdownSlot;
  byUser?: BreakdownSlot;
  byModel?: BreakdownSlot;
  byTenant?: BreakdownSlot;
}

export function CostBreakdownTabs({
  byFeature,
  byUser,
  byModel,
  byTenant,
}: CostBreakdownTabsProps) {
  const defaultTab = byTenant ? "tenant" : "feature";

  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        {byTenant && <TabsTrigger value="tenant">Por Tenant</TabsTrigger>}
        {byFeature && <TabsTrigger value="feature">Por Feature</TabsTrigger>}
        {byUser && <TabsTrigger value="user">Por Usuario</TabsTrigger>}
        {byModel && <TabsTrigger value="model">Por Modelo</TabsTrigger>}
      </TabsList>
      {byTenant && (
        <TabsContent value="tenant">
          <BreakdownTable data={byTenant.data} isLoading={byTenant.isLoading} />
        </TabsContent>
      )}
      {byFeature && (
        <TabsContent value="feature">
          <BreakdownTable data={byFeature.data} isLoading={byFeature.isLoading} />
        </TabsContent>
      )}
      {byUser && (
        <TabsContent value="user">
          <BreakdownTable data={byUser.data} isLoading={byUser.isLoading} />
        </TabsContent>
      )}
      {byModel && (
        <TabsContent value="model">
          <BreakdownTable data={byModel.data} isLoading={byModel.isLoading} />
        </TabsContent>
      )}
    </Tabs>
  );
}
