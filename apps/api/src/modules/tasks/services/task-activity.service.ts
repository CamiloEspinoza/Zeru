import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ActivityQueryDto } from '../dto';

export interface RecordActivityParams {
  tenantId: string;
  taskId: string;
  actorId?: string;
  action: string;
  data?: Record<string, unknown>;
}

@Injectable()
export class TaskActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async recordActivity(params: RecordActivityParams) {
    const client = this.prisma.forTenant(
      params.tenantId,
    ) as unknown as PrismaClient;

    return client.taskActivity.create({
      data: {
        taskId: params.taskId,
        actorId: params.actorId,
        action: params.action,
        data: params.data ?? undefined,
        tenantId: params.tenantId,
      },
    });
  }

  async findByTask(tenantId: string, taskId: string, dto: ActivityQueryDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = { taskId };

    // Cursor-based pagination: get activities created before the cursor's timestamp
    if (dto.cursor) {
      const cursorActivity = await client.taskActivity.findFirst({
        where: { id: dto.cursor },
        select: { createdAt: true },
      });
      if (cursorActivity) {
        where.createdAt = { lt: cursorActivity.createdAt };
      }
    }

    const activities = await client.taskActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: dto.limit + 1, // Fetch one extra to determine hasMore
      include: {
        actor: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const hasMore = activities.length > dto.limit;
    const items = hasMore ? activities.slice(0, dto.limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    return {
      data: items,
      meta: {
        hasMore,
        nextCursor,
      },
    };
  }
}
