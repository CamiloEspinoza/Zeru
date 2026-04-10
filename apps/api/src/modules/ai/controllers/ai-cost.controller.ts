import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('ai/costs')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiCostController {
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
  async summary(@CurrentTenant() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const result = await this.prisma.aiUsageLog.aggregate({
      where: { tenantId, createdAt: period },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true, cachedTokens: true },
      _count: true,
    });
    return {
      totalCostUsd: Number(result._sum.costUsd ?? 0),
      totalInputTokens: result._sum.inputTokens ?? 0,
      totalOutputTokens: result._sum.outputTokens ?? 0,
      totalCachedTokens: result._sum.cachedTokens ?? 0,
      totalInteractions: result._count,
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('by-feature')
  async byFeature(@CurrentTenant() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['feature'],
      where: { tenantId, createdAt: period },
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
          key: r.feature,
          label: r.feature,
          costUsd: Number(r._sum.costUsd ?? 0),
          inputTokens: r._sum.inputTokens ?? 0,
          outputTokens: r._sum.outputTokens ?? 0,
          percentage: totalCost > 0 ? (Number(r._sum.costUsd ?? 0) / totalCost) * 100 : 0,
        }))
        .sort((a, b) => b.costUsd - a.costUsd),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('by-user')
  async byUser(@CurrentTenant() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['userId'],
      where: { tenantId, createdAt: period },
      _sum: { costUsd: true, inputTokens: true, outputTokens: true },
    });
    const userIds = rows.map((r) => r.userId).filter(Boolean) as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));
    const totalCost = rows.reduce((sum, r) => sum + Number(r._sum.costUsd ?? 0), 0);
    return {
      totalCostUsd: totalCost,
      totalInputTokens: rows.reduce((s, r) => s + (r._sum.inputTokens ?? 0), 0),
      totalOutputTokens: rows.reduce((s, r) => s + (r._sum.outputTokens ?? 0), 0),
      totalCachedTokens: 0,
      breakdown: rows
        .map((r) => {
          const user = r.userId ? userMap.get(r.userId) : null;
          return {
            key: r.userId ?? 'unknown',
            label: user ? `${user.firstName} ${user.lastName}` : 'Sin usuario',
            costUsd: Number(r._sum.costUsd ?? 0),
            inputTokens: r._sum.inputTokens ?? 0,
            outputTokens: r._sum.outputTokens ?? 0,
            percentage: totalCost > 0 ? (Number(r._sum.costUsd ?? 0) / totalCost) * 100 : 0,
          };
        })
        .sort((a, b) => b.costUsd - a.costUsd),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }

  @Get('by-model')
  async byModel(@CurrentTenant() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const rows = await this.prisma.aiUsageLog.groupBy({
      by: ['provider', 'model'],
      where: { tenantId, createdAt: period },
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
  async daily(@CurrentTenant() tenantId: string, @Query('from') from?: string, @Query('to') to?: string) {
    const period = this.dateRange(from, to);
    const logs = await this.prisma.aiUsageLog.findMany({
      where: { tenantId, createdAt: period },
      select: { createdAt: true, feature: true, costUsd: true },
      orderBy: { createdAt: 'asc' },
    });
    const dailyMap = new Map<string, { totalCostUsd: number; breakdown: Record<string, number> }>();
    for (const log of logs) {
      const dateStr = log.createdAt.toISOString().split('T')[0];
      if (!dailyMap.has(dateStr)) dailyMap.set(dateStr, { totalCostUsd: 0, breakdown: {} });
      const day = dailyMap.get(dateStr)!;
      const cost = Number(log.costUsd);
      day.totalCostUsd += cost;
      day.breakdown[log.feature] = (day.breakdown[log.feature] ?? 0) + cost;
    }
    return {
      daily: Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data })),
      period: { from: period.gte.toISOString(), to: period.lte.toISOString() },
    };
  }
}
