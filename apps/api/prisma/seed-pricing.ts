import { PrismaClient } from '@prisma/client';

export async function seedPricing(prisma: PrismaClient) {
  const now = new Date('2026-01-01T00:00:00Z');

  const prices = [
    {
      provider: 'OPENAI',
      model: 'gpt-5.4',
      contextTier: 'SHORT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 2.5,
      outputPrice: 15,
      cachedPrice: 0.25,
      longContextThreshold: 200000,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.4',
      contextTier: 'LONG',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 5,
      outputPrice: 22.5,
      cachedPrice: 0.5,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.4-mini',
      contextTier: 'SHORT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 0.75,
      outputPrice: 4.5,
      cachedPrice: 0.075,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.4-nano',
      contextTier: 'SHORT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 0.2,
      outputPrice: 1.25,
      cachedPrice: 0.02,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.4-pro',
      contextTier: 'SHORT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 30,
      outputPrice: 180,
      cachedPrice: 0,
      longContextThreshold: 200000,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.4-pro',
      contextTier: 'LONG',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 60,
      outputPrice: 270,
      cachedPrice: 0,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'gpt-5.2-2025-12-11',
      contextTier: 'SHORT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 1.75,
      outputPrice: 14,
      cachedPrice: 0.175,
      validFrom: now,
    },
    {
      provider: 'OPENAI',
      model: 'text-embedding-3-small',
      contextTier: 'DEFAULT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 0.02,
      outputPrice: 0,
      cachedPrice: 0,
      validFrom: now,
    },
    {
      provider: 'GEMINI',
      model: 'gemini-3.1-flash-image-preview',
      contextTier: 'DEFAULT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 0.5,
      outputPrice: 60,
      cachedPrice: 0,
      description: 'Image output ~$0.067/image at 1K resolution',
      validFrom: now,
    },
    {
      provider: 'GEMINI',
      model: 'gemini-3-pro-image-preview',
      contextTier: 'DEFAULT',
      pricingUnit: 'PER_1M_TOKENS',
      inputPrice: 2,
      outputPrice: 120,
      cachedPrice: 0,
      description: 'Image output ~$0.134/image at 1K-2K resolution',
      validFrom: now,
    },
  ];

  for (const price of prices) {
    await prisma.aiModelPricing.upsert({
      where: {
        provider_model_contextTier_validFrom: {
          provider: price.provider,
          model: price.model,
          contextTier: price.contextTier,
          validFrom: price.validFrom,
        },
      },
      update: {},
      create: price,
    });
  }

  console.log(`Seeded ${prices.length} AI model pricing entries`);
}
