import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { createSoftDeleteExtension } from './extensions/soft-delete.extension';

type ExtendedClient = ReturnType<PrismaClient['$extends']>;

/** Service that delegates to an extended Prisma client with soft delete. Uses Proxy to avoid Object.assign overwriting internal engine state. */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly _client: ExtendedClient;
  /** Raw PrismaClient without soft-delete extension. Use for queries that need to see deleted records. */
  readonly rawClient: PrismaClient;

  constructor() {
    const base = new PrismaClient();
    this.rawClient = base;
    this._client = base.$extends(
      createSoftDeleteExtension(base),
    ) as ExtendedClient;

    return new Proxy(this, {
      get(target, prop: string | symbol) {
        if (typeof prop === 'string' && (prop in target || ['forTenant', 'onModuleInit', 'onModuleDestroy', '_client', 'rawClient'].includes(prop))) {
          return (target as Record<string | symbol, unknown>)[prop];
        }
        const client = (target as PrismaService)._client;
        if (prop === '$transaction') {
          return (arg: unknown, opts?: unknown) =>
            (base.$transaction as (arg: unknown, opts?: unknown) => unknown)(arg, opts);
        }
        return (client as Record<string | symbol, unknown>)[prop];
      },
    }) as PrismaService;
  }

  async onModuleInit() {
    await this._client.$connect();
  }

  async onModuleDestroy() {
    await this._client.$disconnect();
  }

  /**
   * Returns a Prisma client that automatically filters by tenantId.
   * Uses Prisma client extensions for row-level multitenancy.
   * Soft delete is applied via the base extended client.
   */
  /** Models that do not have a tenantId column (global/auth entities) */
  private static readonly MODELS_WITHOUT_TENANT = new Set([
    'Tenant', 'User', 'LoginCode', 'WaitlistEntry', 'FeatureRequest',
  ]);

  forTenant(tenantId: string) {
    const skipModels = PrismaService.MODELS_WITHOUT_TENANT;
    return this._client.$extends({
      name: 'tenantScope',
      query: {
        $allOperations({ model, args, query, operation }) {
          if (model && skipModels.has(model)) {
            return query(args);
          }

          const writeOps = ['create', 'createMany', 'upsert'];
          const readOps = [
            'findFirst',
            'findMany',
            'findUnique',
            'findFirstOrThrow',
            'findUniqueOrThrow',
            'count',
            'aggregate',
            'groupBy',
          ];
          const mutateOps = ['update', 'updateMany', 'delete', 'deleteMany'];

          if (operation === 'upsert') {
            if (args.where && typeof args.where === 'object') {
              (args.where as Record<string, unknown>).tenantId = tenantId;
            }
            if (args.create && typeof args.create === 'object') {
              (args.create as Record<string, unknown>).tenantId = tenantId;
            }
            if (args.update && typeof args.update === 'object') {
              (args.update as Record<string, unknown>).tenantId = tenantId;
            }
            return query(args);
          }

          if (writeOps.includes(operation)) {
            if ('data' in args) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: Record<string, unknown>) => ({
                  ...d,
                  tenantId,
                }));
              } else if (args.data && typeof args.data === 'object') {
                (args.data as Record<string, unknown>).tenantId = tenantId;
              }
            }
          }

          if ([...readOps, ...mutateOps].includes(operation)) {
            if ('where' in args && args.where) {
              (args.where as Record<string, unknown>).tenantId = tenantId;
            } else if ('where' in args || readOps.includes(operation)) {
              (args as Record<string, unknown>).where = { tenantId };
            }
          }

          return query(args);
        },
      },
    });
  }
}
