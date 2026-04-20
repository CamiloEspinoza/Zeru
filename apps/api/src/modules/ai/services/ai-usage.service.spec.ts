import { Test } from '@nestjs/testing';
import { AiUsageService } from './ai-usage.service';
import { AiPricingService } from './ai-pricing.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('AiUsageService.logUsage', () => {
  let service: AiUsageService;
  let prismaCreate: jest.Mock;

  beforeEach(async () => {
    prismaCreate = jest.fn().mockResolvedValue({ id: 'row-1' });
    const module = await Test.createTestingModule({
      providers: [
        AiUsageService,
        { provide: PrismaService, useValue: { aiUsageLog: { create: prismaCreate } } },
        { provide: AiPricingService, useValue: { calculateCost: jest.fn().mockResolvedValue(0.0123) } },
      ],
    }).compile();
    service = module.get(AiUsageService);
  });

  it('persists durationMs and completedAt when provided', async () => {
    const completedAt = new Date('2026-04-20T14:30:00.000Z');
    await service.logUsage({
      provider: 'OPENAI',
      model: 'gpt-5.4-mini',
      feature: 'validation.sample',
      tenantId: 't1',
      inputTokens: 100,
      outputTokens: 40,
      durationMs: 1234,
      completedAt,
    });

    expect(prismaCreate).toHaveBeenCalledTimes(1);
    const data = prismaCreate.mock.calls[0][0].data;
    expect(data.durationMs).toBe(1234);
    expect(data.completedAt).toEqual(completedAt);
    expect(data.feature).toBe('validation.sample');
  });

  it('omits durationMs and completedAt when not provided (backwards compatible)', async () => {
    await service.logUsage({
      provider: 'OPENAI',
      model: 'gpt-5.4-mini',
      feature: 'chat',
      tenantId: 't1',
    });

    const data = prismaCreate.mock.calls[0][0].data;
    expect(data.durationMs).toBeUndefined();
    expect(data.completedAt).toBeUndefined();
  });
});
