import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';

interface PricingCacheEntry {
  pricing: { inputPrice: Prisma.Decimal; outputPrice: Prisma.Decimal; cachedPrice: Prisma.Decimal; pricingUnit: string };
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AiPricingService {
  private readonly logger = new Logger(AiPricingService.name);
  private cache = new Map<string, PricingCacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async getActivePrice(provider: string, model: string, contextTier = 'DEFAULT') {
    const cacheKey = `${provider}:${model}:${contextTier}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.pricing;
    }

    const pricing = await this.prisma.aiModelPricing.findFirst({
      where: { provider, model, contextTier, validTo: null },
      orderBy: { validFrom: 'desc' },
    });

    if (!pricing) {
      this.logger.warn(`No active pricing for ${provider}/${model}/${contextTier}`);
      return null;
    }

    const entry = {
      inputPrice: pricing.inputPrice,
      outputPrice: pricing.outputPrice,
      cachedPrice: pricing.cachedPrice,
      pricingUnit: pricing.pricingUnit,
    };
    this.cache.set(cacheKey, { pricing: entry, cachedAt: Date.now() });
    return entry;
  }

  determineContextTier(provider: string, model: string, inputTokens: number): string {
    const thresholds: Record<string, number> = {
      'OPENAI:gpt-5.4': 200_000,
      'OPENAI:gpt-5.4-pro': 200_000,
    };
    const threshold = thresholds[`${provider}:${model}`];
    if (threshold && inputTokens > threshold) return 'LONG';
    return 'SHORT';
  }

  async calculateCost(params: {
    provider: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    cachedTokens?: number;
    units?: number;
    costOverrideUsd?: number;
  }): Promise<number> {
    if (params.costOverrideUsd != null) return params.costOverrideUsd;

    const contextTier = params.inputTokens
      ? this.determineContextTier(params.provider, params.model, params.inputTokens)
      : 'DEFAULT';

    const pricing = await this.getActivePrice(params.provider, params.model, contextTier);
    if (!pricing) {
      const fallback = await this.getActivePrice(params.provider, params.model, 'DEFAULT');
      if (!fallback) return 0;
      return this.computeCost(fallback, params);
    }

    return this.computeCost(pricing, params);
  }

  private computeCost(
    pricing: { inputPrice: Prisma.Decimal; outputPrice: Prisma.Decimal; cachedPrice: Prisma.Decimal; pricingUnit: string },
    params: { inputTokens?: number; outputTokens?: number; cachedTokens?: number; units?: number },
  ): number {
    const input = Number(pricing.inputPrice);
    const output = Number(pricing.outputPrice);
    const cached = Number(pricing.cachedPrice);

    switch (pricing.pricingUnit) {
      case 'PER_1M_TOKENS':
        return (
          ((params.inputTokens ?? 0) * input +
            (params.outputTokens ?? 0) * output +
            (params.cachedTokens ?? 0) * cached) /
          1_000_000
        );
      case 'PER_1K_CHARS':
        return ((params.units ?? 0) * input) / 1_000;
      case 'PER_HOUR':
      case 'PER_MINUTE':
        return (params.units ?? 0) * input;
      case 'PER_IMAGE':
      case 'PER_GENERATION':
        return (params.units ?? 0) * output;
      default:
        return 0;
    }
  }

  async findAll() {
    return this.prisma.aiModelPricing.findMany({ orderBy: [{ provider: 'asc' }, { model: 'asc' }, { validFrom: 'desc' }] });
  }

  async findActive() {
    return this.prisma.aiModelPricing.findMany({ where: { validTo: null }, orderBy: [{ provider: 'asc' }, { model: 'asc' }] });
  }

  async create(data: {
    provider: string;
    model: string;
    contextTier?: string;
    pricingUnit: string;
    inputPrice: number;
    outputPrice: number;
    cachedPrice?: number;
    longContextThreshold?: number;
    description?: string;
    validFrom?: Date;
  }) {
    const now = data.validFrom ?? new Date();
    const contextTier = data.contextTier ?? 'DEFAULT';

    await this.prisma.aiModelPricing.updateMany({
      where: { provider: data.provider, model: data.model, contextTier, validTo: null },
      data: { validTo: now },
    });

    this.cache.delete(`${data.provider}:${data.model}:${contextTier}`);

    return this.prisma.aiModelPricing.create({
      data: {
        provider: data.provider,
        model: data.model,
        contextTier,
        pricingUnit: data.pricingUnit,
        inputPrice: data.inputPrice,
        outputPrice: data.outputPrice,
        cachedPrice: data.cachedPrice ?? 0,
        longContextThreshold: data.longContextThreshold,
        description: data.description,
        validFrom: now,
      },
    });
  }

  async update(id: string, data: Partial<{ inputPrice: number; outputPrice: number; cachedPrice: number; description: string }>) {
    const updated = await this.prisma.aiModelPricing.update({ where: { id }, data });
    this.cache.clear();
    return updated;
  }

  async recalculateCosts(from: Date, to: Date) {
    const logs = await this.prisma.aiUsageLog.findMany({
      where: { createdAt: { gte: from, lte: to }, costOverrideUsd: null },
    });

    let count = 0;
    for (const log of logs) {
      const cost = await this.calculateCost({
        provider: log.provider,
        model: log.model,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        cachedTokens: log.cachedTokens,
      });
      await this.prisma.aiUsageLog.update({ where: { id: log.id }, data: { costUsd: cost } });
      count++;
    }
    return count;
  }
}
