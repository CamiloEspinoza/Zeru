import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContext, RequestContextData } from './request-context';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    entityType: string;
    entityId: string;
    action: string;
    changes?: Record<string, { from: unknown; to: unknown }>;
    snapshot?: Record<string, unknown>;
    context?: Partial<RequestContextData>;
  }) {
    const ctx = RequestContext.get();
    const merged = { ...ctx, ...params.context };

    await this.prisma.auditLog.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        changes: params.changes ?? undefined,
        snapshot: params.snapshot ?? undefined,
        actorType: merged?.actorType ?? 'SYSTEM',
        actorId: merged?.actorId ?? null,
        source: merged?.source ?? 'unknown',
        ipAddress: merged?.ipAddress ?? null,
        userAgent: merged?.userAgent ?? null,
        socketId: merged?.socketId ?? null,
        tenantId: merged?.tenantId ?? 'unknown',
      },
    });
  }

  async getEntityHistory(
    entityType: string,
    entityId: string,
    options?: { limit?: number; offset?: number },
  ) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }
}
