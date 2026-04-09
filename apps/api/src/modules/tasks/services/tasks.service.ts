import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateTaskDto,
  UpdateTaskDto,
  ListTasksDto,
  MyTasksDto,
  MoveTaskDto,
  BulkUpdateTasksDto,
} from '../dto';

// ─── Position helpers ───────────────────────────────────────
// Simple lexicographic position strings. We use lowercase alpha
// characters to generate sortable keys between existing ones.

function midpoint(a: string, b: string): string {
  // Pad to same length
  const maxLen = Math.max(a.length, b.length) + 1;
  const pa = a.padEnd(maxLen, 'a');
  const pb = b.padEnd(maxLen, '{'); // '{' is right after 'z'

  let result = '';
  for (let i = 0; i < maxLen; i++) {
    const ca = pa.charCodeAt(i);
    const cb = pb.charCodeAt(i);
    const mid = Math.floor((ca + cb) / 2);
    result += String.fromCharCode(mid);
    if (mid > ca) return result;
  }
  return result + 'n';
}

function generatePosition(before?: string, after?: string): string {
  if (!before && !after) return 'n'; // middle of alphabet
  if (!before) return midpoint('a', after!);
  if (!after) return midpoint(before, '{');
  return midpoint(before, after);
}

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ─── Create ──────────────────────────────────────────────

  async create(tenantId: string, userId: string, dto: CreateTaskDto) {
    const task = await this.prisma.$transaction(async (tx: any) => {
      // Determine task number
      const maxNum = await tx.task.aggregate({
        where: { projectId: dto.projectId, tenantId },
        _max: { number: true },
      });
      const number = (maxNum._max.number ?? 0) + 1;

      // Determine statusId
      let statusId = dto.statusId;
      if (!statusId) {
        const defaultStatus = await tx.taskStatusConfig.findFirst({
          where: { projectId: dto.projectId, isDefault: true, tenantId },
        });
        if (defaultStatus) {
          statusId = defaultStatus.id;
        } else {
          // Fallback: use first status
          const firstStatus = await tx.taskStatusConfig.findFirst({
            where: { projectId: dto.projectId, tenantId },
            orderBy: { sortOrder: 'asc' },
          });
          if (!firstStatus) {
            throw new NotFoundException('El proyecto no tiene estados configurados');
          }
          statusId = firstStatus.id;
        }
      }

      // Generate position — append at the end of the section (or project)
      const lastTask = await tx.task.findFirst({
        where: {
          projectId: dto.projectId,
          sectionId: dto.sectionId ?? null,
          tenantId,
          deletedAt: null,
        },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = generatePosition(lastTask?.position ?? undefined);

      // Create task
      const created = await tx.task.create({
        data: {
          number,
          title: dto.title,
          description: dto.description,
          projectId: dto.projectId,
          sectionId: dto.sectionId,
          statusId,
          parentId: dto.parentId,
          priority: dto.priority,
          position,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          estimate: dto.estimate,
          estimateUnit: dto.estimateUnit,
          createdById: userId,
          tenantId,
        },
      });

      // Create assignees
      if (dto.assigneeIds?.length) {
        await tx.taskAssignee.createMany({
          data: dto.assigneeIds.map((uid: string) => ({
            taskId: created.id,
            userId: uid,
            tenantId,
          })),
        });
      }

      // Create labels
      if (dto.labelIds?.length) {
        await tx.taskLabel.createMany({
          data: dto.labelIds.map((lid: string) => ({
            taskId: created.id,
            labelId: lid,
            tenantId,
          })),
        });
      }

      // Auto-subscribe creator
      await tx.taskSubscriber.create({
        data: {
          taskId: created.id,
          userId,
          tenantId,
        },
      });

      return created;
    });

    this.eventEmitter.emit('task.created', {
      tenantId,
      taskId: task.id,
      projectId: task.projectId,
      sectionId: task.sectionId,
      position: task.position,
      actorId: userId,
      userId,
      task,
    });

    return task;
  }

  // ─── Find All ────────────────────────────────────────────

  async findAll(tenantId: string, userId: string, dto: ListTasksDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Restrict visible projects: PUBLIC OR user is member.
    const projectVisibilityClause = {
      project: {
        deletedAt: null,
        OR: [
          { visibility: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
    };

    const where: Record<string, unknown> = {
      deletedAt: null,
      ...projectVisibilityClause,
      ...(dto.projectId ? { projectId: dto.projectId } : {}),
      ...(dto.statusId ? { statusId: dto.statusId } : {}),
      ...(dto.priority ? { priority: dto.priority } : {}),
      ...(dto.sectionId ? { sectionId: dto.sectionId } : {}),
    };

    // Handle parentId: null means top-level tasks, undefined means no filter
    if (dto.parentId !== undefined) {
      where.parentId = dto.parentId;
    }

    // Assignee filter
    if (dto.assigneeId) {
      where.assignees = { some: { userId: dto.assigneeId } };
    }

    // Label filter
    if (dto.labelIds) {
      const ids = dto.labelIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.labels = { some: { labelId: { in: ids } } };
      }
    }

    // Search
    if (dto.search) {
      where.OR = [
        { title: { contains: dto.search, mode: 'insensitive' } },
        { number: isNaN(Number(dto.search)) ? undefined : Number(dto.search) },
      ].filter((f) => Object.values(f).every((v) => v !== undefined));
    }

    // Due date filters
    if (dto.dueBefore || dto.dueAfter) {
      const dueDateFilter: Record<string, unknown> = {};
      if (dto.dueBefore) dueDateFilter.lte = new Date(dto.dueBefore);
      if (dto.dueAfter) dueDateFilter.gte = new Date(dto.dueAfter);
      where.dueDate = dueDateFilter;
    }

    const [data, total] = await Promise.all([
      client.task.findMany({
        where,
        orderBy: { [dto.sortBy]: dto.sortOrder },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          assignees: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
          labels: {
            include: { label: true },
          },
          status: true,
          section: { select: { id: true, name: true } },
          _count: {
            select: { subtasks: true, comments: true },
          },
        },
      }),
      client.task.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: dto.page,
        perPage: dto.perPage,
        totalPages: Math.ceil(total / dto.perPage),
      },
    };
  }

  // ─── Find One ────────────────────────────────────────────

  async findOne(tenantId: string, taskId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const task = await client.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: {
        assignees: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        labels: {
          include: { label: true },
        },
        status: true,
        section: { select: { id: true, name: true } },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            reactions: true,
          },
        },
        attachments: {
          include: {
            uploadedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        dependencies: {
          include: {
            dependsOn: {
              select: { id: true, title: true, number: true, statusId: true },
            },
          },
        },
        subscribers: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            actor: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        },
        subtasks: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            number: true,
            title: true,
            priority: true,
            statusId: true,
            status: true,
            assignees: {
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
        _count: {
          select: { subtasks: true, comments: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException(`Tarea con id ${taskId} no encontrada`);
    }

    return task;
  }

  // ─── Update ──────────────────────────────────────────────

  async update(
    tenantId: string,
    taskId: string,
    userId: string,
    dto: UpdateTaskDto,
  ) {
    const existing = await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Build update data
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.statusId !== undefined) data.statusId = dto.statusId;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.sectionId !== undefined) data.sectionId = dto.sectionId;
    if (dto.startDate !== undefined) {
      data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.dueDate !== undefined) {
      data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    }
    if (dto.estimate !== undefined) data.estimate = dto.estimate;
    if (dto.estimateUnit !== undefined) data.estimateUnit = dto.estimateUnit;

    // If status changed, check if new status is "done" category
    if (dto.statusId && dto.statusId !== existing.statusId) {
      const newStatus = await client.taskStatusConfig.findFirst({
        where: { id: dto.statusId },
      });
      if (newStatus?.category === 'done') {
        data.completedAt = new Date();
      } else if (existing.completedAt) {
        data.completedAt = null;
      }
    }

    const task = await client.task.update({
      where: { id: taskId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    // Track changes
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (dto.title !== undefined && dto.title !== existing.title) {
      changes.title = { from: existing.title, to: dto.title };
    }
    if (dto.statusId !== undefined && dto.statusId !== existing.statusId) {
      changes.statusId = { from: existing.statusId, to: dto.statusId };
    }
    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      changes.priority = { from: existing.priority, to: dto.priority };
    }

    this.eventEmitter.emit('task.updated', {
      tenantId,
      taskId: task.id,
      projectId: existing.projectId,
      actorId: userId,
      userId,
      changes,
      version: task.version,
      task,
    });

    if (dto.statusId && dto.statusId !== existing.statusId) {
      this.eventEmitter.emit('task.status_changed', {
        tenantId,
        taskId: task.id,
        projectId: existing.projectId,
        userId,
        fromStatusId: existing.statusId,
        toStatusId: dto.statusId,
      });
    }

    return task;
  }

  // ─── Move ────────────────────────────────────────────────

  async move(
    tenantId: string,
    taskId: string,
    userId: string,
    dto: MoveTaskDto,
  ) {
    const existing = await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const data: Record<string, unknown> = {
      position: dto.position,
    };

    if (dto.sectionId !== undefined) {
      data.sectionId = dto.sectionId;
    }
    if (dto.statusId) {
      data.statusId = dto.statusId;

      // Check if new status is "done"
      const newStatus = await client.taskStatusConfig.findFirst({
        where: { id: dto.statusId },
      });
      if (newStatus?.category === 'done') {
        data.completedAt = new Date();
      } else if (existing.completedAt) {
        data.completedAt = null;
      }
    }

    const task = await client.task.update({
      where: { id: taskId },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });

    this.eventEmitter.emit('task.moved', {
      tenantId,
      taskId: task.id,
      projectId: existing.projectId,
      actorId: userId,
      userId,
      fromSectionId: existing.sectionId,
      toSectionId: dto.sectionId ?? existing.sectionId,
      position: dto.position,
      version: task.version,
      task,
    });

    return task;
  }

  // ─── Bulk Update ─────────────────────────────────────────

  async bulkUpdate(tenantId: string, userId: string, dto: BulkUpdateTasksDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Pre-load tasks: we need projectId for events and to validate that
    // every requested task exists for the tenant. The TaskAccessGuard
    // already enforces project membership for all distinct projectIds,
    // so by the time we get here we know the user is allowed to mutate
    // tasks in those projects.
    const existingTasks = await client.task.findMany({
      where: { id: { in: dto.taskIds }, deletedAt: null },
      select: { id: true, projectId: true },
    });

    if (existingTasks.length !== dto.taskIds.length) {
      throw new NotFoundException('Una o más tareas no existen');
    }

    const updatedTasks = await this.prisma.$transaction(async (tx: any) => {
      const updated: Array<{ id: string; projectId: string; version: number }> = [];

      for (const taskId of dto.taskIds) {
        const data: Record<string, unknown> = {};
        if (dto.update.statusId !== undefined) data.statusId = dto.update.statusId;
        if (dto.update.priority !== undefined) data.priority = dto.update.priority;
        if (dto.update.sectionId !== undefined) data.sectionId = dto.update.sectionId;
        if (dto.update.dueDate !== undefined) {
          data.dueDate = dto.update.dueDate ? new Date(dto.update.dueDate) : null;
        }

        // Handle assignee separately
        if (dto.update.assigneeId !== undefined) {
          if (dto.update.assigneeId === null) {
            // Remove all assignees
            await tx.taskAssignee.deleteMany({
              where: { taskId, tenantId },
            });
          } else {
            // Upsert assignee
            await tx.taskAssignee.upsert({
              where: { taskId_userId: { taskId, userId: dto.update.assigneeId } },
              create: { taskId, userId: dto.update.assigneeId, tenantId },
              update: {},
            });
          }
        }

        if (Object.keys(data).length > 0) {
          const task = await tx.task.update({
            where: { id: taskId, tenantId },
            data: {
              ...data,
              version: { increment: 1 },
            },
          });
          updated.push({
            id: task.id,
            projectId: task.projectId,
            version: task.version,
          });
        }
      }

      return updated;
    });

    // Emit events only for tasks that were actually updated, with the
    // correct projectId so the realtime gateway can broadcast to the
    // matching project room.
    for (const task of updatedTasks) {
      this.eventEmitter.emit('task.updated', {
        tenantId,
        taskId: task.id,
        projectId: task.projectId,
        actorId: userId,
        userId,
        changes: dto.update,
        version: task.version,
        bulk: true,
      });
    }

    return { updated: updatedTasks.length };
  }

  // ─── Remove ──────────────────────────────────────────────

  async remove(tenantId: string, taskId: string, userId: string) {
    const existing = await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.task.update({
      where: { id: taskId },
      data: { deletedAt: new Date() },
    });

    this.eventEmitter.emit('task.deleted', {
      tenantId,
      taskId,
      projectId: existing.projectId,
      actorId: userId,
      userId,
    });

    return { message: 'Tarea eliminada' };
  }

  // ─── Assignees ───────────────────────────────────────────

  async addAssignee(
    tenantId: string,
    taskId: string,
    userId: string,
    assigneeId: string,
  ) {
    const existing = await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    let assignee;
    try {
      assignee = await client.taskAssignee.create({
        data: { taskId, userId: assigneeId, tenantId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'El usuario ya está asignado a esta tarea',
        );
      }
      throw e;
    }

    this.eventEmitter.emit('task.assigned', {
      tenantId,
      taskId,
      projectId: existing.projectId,
      userId,
      actorId: userId,
      assigneeId,
    });

    return assignee;
  }

  async removeAssignee(
    tenantId: string,
    taskId: string,
    _userId: string,
    assigneeId: string,
  ) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.taskAssignee.delete({
      where: { taskId_userId: { taskId, userId: assigneeId } },
    });

    return { message: 'Asignado removido' };
  }

  // ─── Subscribers ─────────────────────────────────────────

  async addSubscriber(
    tenantId: string,
    taskId: string,
    subscriberId: string,
  ) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    try {
      return await client.taskSubscriber.create({
        data: { taskId, userId: subscriberId, tenantId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'El usuario ya está suscrito a esta tarea',
        );
      }
      throw e;
    }
  }

  async removeSubscriber(
    tenantId: string,
    taskId: string,
    subscriberId: string,
  ) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.taskSubscriber.delete({
      where: { taskId_userId: { taskId, userId: subscriberId } },
    });

    return { message: 'Suscriptor removido' };
  }

  // ─── Labels ──────────────────────────────────────────────

  async addLabel(tenantId: string, taskId: string, labelId: string) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    try {
      return await client.taskLabel.create({
        data: { taskId, labelId, tenantId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'La etiqueta ya está aplicada a esta tarea',
        );
      }
      throw e;
    }
  }

  async removeLabel(tenantId: string, taskId: string, labelId: string) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.taskLabel.delete({
      where: { taskId_labelId: { taskId, labelId } },
    });

    return { message: 'Etiqueta removida' };
  }

  // ─── Dependencies ────────────────────────────────────────

  async addDependency(
    tenantId: string,
    taskId: string,
    dependsOnId: string,
    dependencyType: string,
  ) {
    // Prevent self-dependency
    if (taskId === dependsOnId) {
      throw new BadRequestException('Una tarea no puede depender de si misma');
    }

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify both tasks exist (cheap exists check; full findOne is overkill)
    const [taskExists, dependsOnExists] = await Promise.all([
      client.task.findFirst({
        where: { id: taskId, deletedAt: null },
        select: { id: true },
      }),
      client.task.findFirst({
        where: { id: dependsOnId, deletedAt: null },
        select: { id: true },
      }),
    ]);
    if (!taskExists) {
      throw new NotFoundException(`Tarea con id ${taskId} no encontrada`);
    }
    if (!dependsOnExists) {
      throw new NotFoundException(
        `Tarea con id ${dependsOnId} no encontrada`,
      );
    }

    // Cycle detection: walk forward from dependsOnId through existing
    // dependencies. If we reach `taskId`, adding (taskId → dependsOnId)
    // would create a cycle.
    const visited = new Set<string>();
    const queue: string[] = [dependsOnId];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      if (visited.has(current)) continue;
      visited.add(current);

      if (current === taskId) {
        throw new BadRequestException(
          'Esta dependencia crearía un ciclo',
        );
      }

      const next = await client.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnId: true },
      });
      for (const edge of next as Array<{ dependsOnId: string }>) {
        if (!visited.has(edge.dependsOnId)) {
          queue.push(edge.dependsOnId);
        }
      }
    }

    try {
      return await client.taskDependency.create({
        data: { taskId, dependsOnId, dependencyType, tenantId },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('Esta dependencia ya existe');
      }
      throw e;
    }
  }

  async removeDependency(tenantId: string, taskId: string, depId: string) {
    await this.findOne(tenantId, taskId);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await client.taskDependency.delete({
      where: { id: depId },
    });

    return { message: 'Dependencia removida' };
  }

  // ─── My Tasks ────────────────────────────────────────────

  async findMyTasks(tenantId: string, userId: string, dto: MyTasksDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = {
      deletedAt: null,
      assignees: { some: { userId } },
    };

    if (dto.status) {
      where.status = { slug: dto.status };
    }

    if (dto.dueWithinDays) {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + dto.dueWithinDays);
      where.dueDate = { lte: deadline };
    }

    const [data, total] = await Promise.all([
      client.task.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        skip: (dto.page - 1) * dto.perPage,
        take: dto.perPage,
        include: {
          project: { select: { id: true, name: true, key: true, color: true } },
          status: true,
          assignees: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
          _count: { select: { subtasks: true, comments: true } },
        },
      }),
      client.task.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page: dto.page,
        perPage: dto.perPage,
        totalPages: Math.ceil(total / dto.perPage),
      },
    };
  }
}
