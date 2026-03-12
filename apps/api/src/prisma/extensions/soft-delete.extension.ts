import { Prisma, PrismaClient } from '@prisma/client';

/** Prisma delegates use camelCase (e.g. prisma.user, prisma.tenant) */
const SOFT_DELETABLE_MODELS = new Set([
  'tenant',
  'user',
  'userTenant',
  'aiProviderConfig',
  'geminiConfig',
  'storageConfig',
  'emailConfig',
  'conversation',
  'message',
  'memory',
  'account',
  'journalEntry',
  'journalEntryLine',
  'fiscalPeriod',
  'accountingProcessStep',
  'document',
  'apiKey',
  'waitlistEntry',
  'linkedInConnection',
  'linkedInPost',
  'linkedInAgentConfig',
]);

const READ_OPS = new Set([
  'findFirst',
  'findMany',
  'findUnique',
  'findFirstOrThrow',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

function mergeWhereDeletedAtNull(where: Record<string, unknown>): Record<string, unknown> {
  if (!where || typeof where !== 'object') return { deletedAt: null };
  return {
    ...where,
    deletedAt: null,
  };
}

/**
 * Creates a Prisma client extension that implements soft delete:
 * - Intercepts delete/deleteMany and converts to update with deletedAt
 * - Adds deletedAt: null filter to all read operations
 */
export function createSoftDeleteExtension(client: PrismaClient) {
  return Prisma.defineExtension({
    name: 'softDelete',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // model is the PascalCase model name (e.g. "LinkedInPost"). Convert to camelCase for set lookup.
          const rawModel = model ?? '';
          const modelName = rawModel ? rawModel[0].toLowerCase() + rawModel.slice(1) : '';
          const isSoftDeletable = SOFT_DELETABLE_MODELS.has(modelName);

          if (!isSoftDeletable) {
            return query(args);
          }

          if (operation === 'delete') {
            return (client as Record<string, unknown>)[modelName].update({
              ...args,
              data: { deletedAt: new Date() },
            });
          }

          if (operation === 'deleteMany') {
            return (client as Record<string, unknown>)[modelName].updateMany({
              ...args,
              data: { deletedAt: new Date() },
            });
          }

          if (READ_OPS.has(operation)) {
            const mergedArgs = { ...args };
            if ('where' in mergedArgs && mergedArgs.where) {
              (mergedArgs as Record<string, unknown>).where = mergeWhereDeletedAtNull(
                mergedArgs.where as Record<string, unknown>,
              );
            } else {
              (mergedArgs as Record<string, unknown>).where = { deletedAt: null };
            }
            return query(mergedArgs);
          }

          return query(args);
        },
      },
    },
  });
}
