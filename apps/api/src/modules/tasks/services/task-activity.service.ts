import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  private readonly logger = new Logger(TaskActivityService.name);

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

  // ─── Event Listeners ─────────────────────────────────────
  // Activity feed entries are written from the event bus so that
  // the services that mutate tasks don't have to know about activity.

  private extractActorId(payload: Record<string, unknown>): string | undefined {
    return (
      (payload.actorId as string | undefined) ??
      (payload.userId as string | undefined)
    );
  }

  private async safeRecord(params: RecordActivityParams): Promise<void> {
    try {
      await this.recordActivity(params);
    } catch (err) {
      this.logger.error(
        `Failed to record activity ${params.action} for task ${params.taskId}`,
        err,
      );
    }
  }

  @OnEvent('task.created')
  async onTaskCreated(payload: {
    tenantId: string;
    taskId: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.created',
      data: { task: payload.task },
    });
  }

  @OnEvent('task.updated')
  async onTaskUpdated(payload: {
    tenantId: string;
    taskId: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.updated',
      data: { changes: payload.changes ?? null },
    });
  }

  @OnEvent('task.status_changed')
  async onTaskStatusChanged(payload: {
    tenantId: string;
    taskId: string;
    fromStatusId?: string;
    toStatusId?: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.status_changed',
      data: {
        fromStatusId: payload.fromStatusId,
        toStatusId: payload.toStatusId,
      },
    });
  }

  @OnEvent('task.moved')
  async onTaskMoved(payload: {
    tenantId: string;
    taskId: string;
    fromSectionId?: string | null;
    toSectionId?: string | null;
    position?: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.moved',
      data: {
        fromSectionId: payload.fromSectionId ?? null,
        toSectionId: payload.toSectionId ?? null,
        position: payload.position,
      },
    });
  }

  @OnEvent('task.assigned')
  async onTaskAssigned(payload: {
    tenantId: string;
    taskId: string;
    assigneeId?: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.assigned',
      data: { assigneeId: payload.assigneeId },
    });
  }

  @OnEvent('task.comment.created')
  async onTaskCommentCreated(payload: {
    tenantId: string;
    taskId: string;
    commentId?: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.comment.created',
      data: { commentId: payload.commentId },
    });
  }

  @OnEvent('task.deleted')
  async onTaskDeleted(payload: {
    tenantId: string;
    taskId: string;
    [key: string]: unknown;
  }) {
    await this.safeRecord({
      tenantId: payload.tenantId,
      taskId: payload.taskId,
      actorId: this.extractActorId(payload),
      action: 'task.deleted',
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
          select: { id: true, firstName: true, lastName: true, avatarUrl: true },
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
