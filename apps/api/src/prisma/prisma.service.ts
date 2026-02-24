import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Returns a Prisma client that automatically filters by tenantId.
   * Uses Prisma client extensions for row-level multitenancy.
   */
  forTenant(tenantId: string) {
    return this.$extends({
      query: {
        $allOperations({ args, query, operation }) {
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

          if (writeOps.includes(operation)) {
            if ('data' in args) {
              if (Array.isArray(args.data)) {
                args.data = args.data.map((d: any) => ({
                  ...d,
                  tenantId,
                }));
              } else if (args.data && typeof args.data === 'object') {
                (args.data as any).tenantId = tenantId;
              }
            }
          }

          if ([...readOps, ...mutateOps].includes(operation)) {
            if ('where' in args && args.where) {
              (args.where as any).tenantId = tenantId;
            } else if ('where' in args || readOps.includes(operation)) {
              (args as any).where = { tenantId };
            }
          }

          return query(args);
        },
      },
    });
  }
}
