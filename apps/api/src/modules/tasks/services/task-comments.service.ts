import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { CreateCommentDto, UpdateCommentDto } from '../dto';

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, taskId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.taskComment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            reactions: true,
          },
        },
        reactions: true,
      },
    });
  }

  async create(
    tenantId: string,
    taskId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify task exists
    const task = await client.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!task) {
      throw new NotFoundException(`Tarea con id ${taskId} no encontrada`);
    }

    const comment = await client.taskComment.create({
      data: {
        content: dto.content,
        taskId,
        authorId: userId,
        parentId: dto.parentId,
        tenantId,
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Auto-subscribe commenter to task
    await client.taskSubscriber
      .create({
        data: { taskId, userId, tenantId },
      })
      .catch(() => {
        // Ignore duplicate subscription
      });

    this.eventEmitter.emit('task.comment.created', {
      tenantId,
      taskId,
      commentId: comment.id,
      projectId: task.projectId,
      userId,
    });

    // Handle mentions
    if (dto.mentionedUserIds?.length) {
      for (const mentionedUserId of dto.mentionedUserIds) {
        this.eventEmitter.emit('task.mentioned', {
          tenantId,
          taskId,
          commentId: comment.id,
          projectId: task.projectId,
          mentionedUserId,
          mentionedByUserId: userId,
        });
      }
    }

    return comment;
  }

  async update(
    tenantId: string,
    commentId: string,
    userId: string,
    dto: UpdateCommentDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const comment = await client.taskComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Solo el autor puede editar este comentario');
    }

    return client.taskComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        editedAt: new Date(),
      },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async remove(tenantId: string, commentId: string, userId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const comment = await client.taskComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Solo el autor puede eliminar este comentario');
    }

    await client.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    return { message: 'Comentario eliminado' };
  }

  async addReaction(
    tenantId: string,
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const comment = await client.taskComment.findFirst({
      where: { id: commentId, deletedAt: null },
    });
    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    return (client as any).taskCommentReaction.create({
      data: { commentId, userId, emoji },
    });
  }

  async removeReaction(
    tenantId: string,
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    await (client as any).taskCommentReaction.deleteMany({
      where: { commentId, userId, emoji },
    });

    return { message: 'Reaccion removida' };
  }
}
