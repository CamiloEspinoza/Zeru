import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Step 1: Backfill userId from Conversation
  const logsWithConversation = await prisma.aiUsageLog.findMany({
    where: { userId: null, conversationId: { not: null } },
    select: { id: true, conversationId: true },
  });

  console.log(
    `Backfilling userId for ${logsWithConversation.length} logs with conversationId...`,
  );

  for (const log of logsWithConversation) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: log.conversationId! },
      select: { userId: true },
    });
    if (conversation?.userId) {
      await prisma.aiUsageLog.update({
        where: { id: log.id },
        data: { userId: conversation.userId },
      });
    }
  }

  // Step 2: Backfill costUsd using pricing table
  const allLogs = await prisma.aiUsageLog.findMany({
    where: { costUsd: 0, costOverrideUsd: null },
  });

  console.log(`Recalculating costs for ${allLogs.length} logs...`);

  let updated = 0;
  for (const log of allLogs) {
    let contextTier = 'SHORT';
    const key = `${log.provider}:${log.model}`;
    if (
      (key === 'OPENAI:gpt-5.4' || key === 'OPENAI:gpt-5.4-pro') &&
      log.inputTokens > 200000
    ) {
      contextTier = 'LONG';
    }

    let pricing = await prisma.aiModelPricing.findFirst({
      where: {
        provider: log.provider,
        model: log.model,
        contextTier,
        validFrom: { lte: log.createdAt },
        OR: [{ validTo: null }, { validTo: { gte: log.createdAt } }],
      },
      orderBy: { validFrom: 'desc' },
    });

    if (!pricing) {
      pricing = await prisma.aiModelPricing.findFirst({
        where: {
          provider: log.provider,
          model: log.model,
          contextTier: 'DEFAULT',
          validFrom: { lte: log.createdAt },
          OR: [{ validTo: null }, { validTo: { gte: log.createdAt } }],
        },
        orderBy: { validFrom: 'desc' },
      });
      if (!pricing) continue;
    }

    const cost =
      (log.inputTokens * Number(pricing.inputPrice) +
        log.outputTokens * Number(pricing.outputPrice) +
        log.cachedTokens * Number(pricing.cachedPrice)) /
      1_000_000;

    await prisma.aiUsageLog.update({
      where: { id: log.id },
      data: { costUsd: cost },
    });
    updated++;
  }

  console.log(`Updated ${updated} logs with calculated costs`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
