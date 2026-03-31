import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../common/guards/super-admin.guard';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('ai/costs/global')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AiCostGlobalController {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(from?: string, to?: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      gte: from ? new Date(from) : startOfMonth,
      lte: to ? new Date(to) : now,
    };
  }

  @Get('summary')
  async summary(@Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const result = await this.prisma.aiUsageLog.aggregate({
      where: { createdAt: period },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, cachedTokens: true },
      _count: true,
    });
    const activeTenants = await this.prisma.aiUsageLog.groupBy({
      by: ['tenantId'],
      where: { createdAt: period },
    });
    return {
      totalCostUsd: Number(result._sum.costUsd ?? 0),
      totalInputTokens: result._sum.inputTokens ?? 0,
      totalOutputTokens: result._sum.outputTokens ?? 0,
      totalCachedTokens: result._sum.cachedTokens ?? 0,
      totalInteractions: result._count,
      activeTenants: activeTenants.length,
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('by-tenant')
  async byTenant(@Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['tenantId'],
      where: { createdAt: period },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    });
    const tenantIds = rows.map((r) => r.tenantId);
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
    const totalCost = rows.reduce((sum, r) => sum + Number(r._sum.costUsd ?? 0), 0);
    return {
      totalCostUsd: totalCost,
      totalInputTokens: rows.reduce((s, r) => s + (r._sum.inputTokens ?? 0), 0),
      totalOutputTokens: rows.reduce((s, r) => s + (r._sum.outputTokens ?? 0), 0),
      totalCachedTokens: 0,
      breakdown: rows
        .map((r) => ({
          key: r.tenantId,
          label: tenantMap.get(r.tenantId) ?? r.tenantId,
          costUsd: Number(r._sum.costUsd ?? 0),
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          percentage: totalCost > 0 ? (Number(r._sum.costUsd ?? 0) / totalCost) * 100 : 0,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('by-model')
  async byModel(@Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['provider', 'model'],
      where: { createdAt: period },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    });
    const totalCost = rows.reduce((sum, r) => sum + Number(r._sum.costUsd ?? 0), 0);
    return {
      totalCostUsd: totalCost,
      totalInputTokens: rows.reduce((s, r) => s + (r._sum.inputTokens ?? 0), 0),
      totalOutputTokens: rows.reduce((s, r) => s + (r._sum.outputTokens ?? 0), 0),
      totalCachedTokens: 0,
      breakdown: rows
        .map((r) => ({
          key: `${r.provider}:${r.model}`,
          label: `${r.model} (${r.provider})`,
          costUsd: Number(r._sum.costUsd ?? 0),
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          percentage: totalCost > 0 ? (Number(r._sum.costUsd ?? 0) / totalCost) * 100 : 0,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('daily')
  async daily(@Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const logs = await this.prisma.$queryRaw<Array<{ date: string; tenant_id: string; cost: number }>>`
      SELECT DATE(created_at) as date, tenant_id, SUM(cost_usd)::float as cost
      FROM ai_usage_logs
      WHERE created_at >= ${period.gte} AND created_at <= ${period.lte}
      GROUP BY DATE(created_at), tenant_id
      ORDER BY date
    `;
    const tenantIds = [...new Set(logs.map((l) => l.tenant_id))];
    const tenants = await this.prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map((t) => [t.id, t.name]));
    const dailyMap = new Map<string, { totalCostUsd: number; breakdown: Record<string, number> }>();
    for (const row of logs) {
      const dateStr = String(row.date);
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { totalCostUsd: 0, breakdown: {} });
      const day = dailyMap.get(dateStr)!;
      day.totalCostUsd += row.cost;
      const label = tenantMap.get(row.tenant_id) ?? row.tenant_id;
      day.breakdown[label] = (day.breakdown[label] ?? 0) + row.cost;
    }
    return {
      daily: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }
}
