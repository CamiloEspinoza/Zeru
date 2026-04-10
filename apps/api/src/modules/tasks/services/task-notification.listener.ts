import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationService } from '../../notification/notification.service';

@Injectable()
export class TaskNotificationListener {
  private readonly logger = new Logger(TaskNotificationListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // ─── Task Assigned ───────────────────────────────────────

  @OnEvent('task.assigned')
  async handleTaskAssigned(payload: {
    tenantId: string;
    taskId: string;
    userId: string; // actor
    assigneeId: string;
  }) {
    if (payload.userId === payload.assigneeId) return;

    const task = await this.findTask(payload.tenantId, payload.taskId);
    if (!task) return;

    await this.notificationService.notify({
      type: 'task.assigned',
      title: 'Te asignaron una tarea',
      body: task.title,
      data: { projectId: task.projectId, taskId: task.id, taskNumber: task.number },
      groupKey: `task-assign:${task.id}`,
      recipientId: payload.assigneeId,
      tenantId: payload.tenantId,
    });
  }

  // ─── Task Status Changed ─────────────────────────────────

  @OnEvent('task.status_changed')
  async handleTaskStatusChanged(payload: {
    tenantId: string;
    taskId: string;
    projectId: string;
    userId: string; // actor
    fromStatusId: string;
    toStatusId: string;
  }) {
    const client = this.prisma.forTenant(payload.tenantId) as unknown as PrismaClient;

    const [task, newStatus] = await Promise.all([
      this.findTask(payload.tenantId, payload.taskId),
      client.taskStatusConfig.findFirst({ where: { id: payload.toStatusId } }),
    ]);
    if (!task) return;

    const statusName = newStatus?.name ?? 'desconocido';

    // Notify creator + assignees + subscribers (excluding actor)
    const recipientIds = new Set<string>();

    if (task.createdById) recipientIds.add(task.createdById);
    for (const a of task.assignees) recipientIds.add(a.userId);
    for (const s of task.subscribers) recipientIds.add(s.userId);

    recipientIds.delete(payload.userId); // exclude actor

    for (const recipientId of recipientIds) {
      await this.notificationService.notify({
        type: 'task.status_changed',
        title: `Tarea marcada como ${statusName}`,
        body: task.title,
        data: { projectId: payload.projectId, taskId: task.id, taskNumber: task.number },
        groupKey: `task-status:${task.id}`,
        recipientId,
        tenantId: payload.tenantId,
      });
    }

    // If the new status is "done", also emit task.completed
    if (newStatus?.category === 'done') {
      await this.handleTaskCompleted({
        tenantId: payload.tenantId,
        taskId: payload.taskId,
        projectId: payload.projectId,
        userId: payload.userId,
      });
    }
  }

  // ─── Task Comment Created ────────────────────────────────

  @OnEvent('task.comment.created')
  async handleTaskCommentCreated(payload: {
    tenantId: string;
    taskId: string;
    commentId: string;
    projectId: string;
    userId: string; // comment author
  }) {
    const task = await this.findTask(payload.tenantId, payload.taskId);
    if (!task) return;

    // Notify all subscribers except the comment author
    const recipientIds = new Set<string>();
    for (const s of task.subscribers) recipientIds.add(s.userId);
    recipientIds.delete(payload.userId);

    for (const recipientId of recipientIds) {
      await this.notificationService.notify({
        type: 'task.comment.created',
        title: 'Nuevo comentario en tarea',
        body: task.title,
        data: {
          projectId: payload.projectId,
          taskId: task.id,
          taskNumber: task.number,
          commentId: payload.commentId,
        },
        groupKey: `task-comment:${task.id}`,
        recipientId,
        tenantId: payload.tenantId,
      });
    }
  }

  // ─── Task Completed ──────────────────────────────────────

  async handleTaskCompleted(payload: {
    tenantId: string;
    taskId: string;
    projectId: string;
    userId: string; // the user who completed it
  }) {
    const task = await this.findTask(payload.tenantId, payload.taskId);
    if (!task) return;

    // Notify creator if they are not the one completing
    if (task.createdById && task.createdById !== payload.userId) {
      await this.notificationService.notify({
        type: 'task.completed',
        title: 'Tarea completada',
        body: task.title,
        data: { projectId: payload.projectId, taskId: task.id, taskNumber: task.number },
        groupKey: `task-complete:${task.id}`,
        recipientId: task.createdById,
        tenantId: payload.tenantId,
      });
    }
  }

  // ─── Task Mentioned ──────────────────────────────────────

  @OnEvent('task.mentioned')
  async handleTaskMentioned(payload: {
    tenantId: string;
    taskId: string;
    commentId: string;
    projectId: string;
    mentionedUserId: string;
    mentionedByUserId: string;
  }) {
    if (payload.mentionedByUserId === payload.mentionedUserId) return;

    const task = await this.findTask(payload.tenantId, payload.taskId);
    if (!task) return;

    await this.notificationService.notify({
      type: 'task.mentioned',
      title: 'Te mencionaron en una tarea',
      body: task.title,
      data: {
        projectId: payload.projectId,
        taskId: task.id,
        taskNumber: task.number,
        commentId: payload.commentId,
      },
      groupKey: `task-mention:${task.id}:${payload.mentionedUserId}`,
      recipientId: payload.mentionedUserId,
      tenantId: payload.tenantId,
    });
  }

  // ─── Project Member Added ────────────────────────────────

  @OnEvent('project.member_added')
  async handleProjectMemberAdded(payload: {
    tenantId: string;
    projectId: string;
    userId: string; // new member
    role: string;
    actorId: string;
  }) {
    if (payload.actorId === payload.userId) return;

    const client = this.prisma.forTenant(payload.tenantId) as unknown as PrismaClient;
    const project = await client.project.findFirst({
      where: { id: payload.projectId, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!project) return;

    await this.notificationService.notify({
      type: 'project.member_added',
      title: 'Te agregaron al proyecto',
      body: project.name,
      data: { projectId: payload.projectId },
      groupKey: `project-member:${payload.projectId}:${payload.userId}`,
      recipientId: payload.userId,
      tenantId: payload.tenantId,
    });
  }

  // ─── Task Due Soon ───────────────────────────────────────

  @OnEvent('task.due_soon')
  async handleTaskDueSoon(payload: {
    tenantId: string;
    projectId: string;
    taskId: string;
    taskTitle: string;
    userId: string;
  }) {
    await this.notificationService.notify({
      type: 'task.due_soon',
      title: 'Tarea por vencer',
      body: payload.taskTitle,
      data: { projectId: payload.projectId, taskId: payload.taskId },
      groupKey: `task-due:${payload.taskId}`,
      recipientId: payload.userId,
      tenantId: payload.tenantId,
    });
  }

  // ─── Helpers ─────────────────────────────────────────────

  private async findTask(tenantId: string, taskId: string) {
    try {
      const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
      return await client.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: {
          id: true,
          title: true,
          number: true,
          projectId: true,
          createdById: true,
          assignees: { select: { userId: true } },
          subscribers: { select: { userId: true } },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to find task ${taskId}`, err);
      return null;
    }
  }
}
