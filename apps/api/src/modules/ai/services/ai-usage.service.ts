import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiPricingService } from './ai-pricing.service';

export interface LogAiUsageParams {
  provider: string;
  model: string;
  feature: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  compacted?: boolean;
  units?: number;
  pricingUnit?: string;
  costOverrideUsd?: number;
  durationMs?: number;
  completedAt?: Date;
}

@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: AiPricingService,
  ) {}

  async logUsage(params: LogAiUsageParams) {
    const costUsd = await this.pricingService.calculateCost({
      provider: params.provider,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cachedTokens: params.cachedTokens,
      units: params.units,
      costOverrideUsd: params.costOverrideUsd,
    });

    return this.prisma.aiUsageLog.create({
      data: {
        provider: params.provider,
        model: params.model,
        feature: params.feature,
        inputTokens: params.inputTokens ?? 0,
        outputTokens: params.outputTokens ?? 0,
        totalTokens: params.totalTokens ?? (params.inputTokens ?? 0) + (params.outputTokens ?? 0),
        cachedTokens: params.cachedTokens ?? 0,
        compacted: params.compacted ?? false,
        costUsd,
        costOverrideUsd: params.costOverrideUsd,
        units: params.units,
        pricingUnit: params.pricingUnit,
        durationMs: params.durationMs,
        completedAt: params.completedAt,
        tenantId: params.tenantId,
        userId: params.userId,
        conversationId: params.conversationId,
      },
    });
  }
}
