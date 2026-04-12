import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { USER_SUMMARY_SELECT, mapUserWithAvatar } from '../../users/user-select';
import type { CreateCommentDto, UpdateCommentDto } from '../dto';

@Injectable()
export class TaskCommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, taskId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const raw = await client.taskComment.findMany({
      where: { taskId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: USER_SUMMARY_SELECT },
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            author: { select: USER_SUMMARY_SELECT },
            reactions: true,
          },
        },
        reactions: true,
      },
    });

    return raw.map((c) => ({
      ...c,
      author: mapUserWithAvatar(c.author),
      replies: c.replies.map((r) => ({
        ...r,
        author: mapUserWithAvatar(r.author),
      })),
    }));
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

    const rawComment = await client.taskComment.create({
      data: {
        content: dto.content,
        taskId,
        authorId: userId,
        parentId: dto.parentId,
        tenantId,
      },
      include: {
        author: { select: USER_SUMMARY_SELECT },
      },
    });

    const comment = { ...rawComment, author: mapUserWithAvatar(rawComment.author) };

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
      actorId: userId,
      userId,
      comment,
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

    const task = await client.task.findUnique({
      where: { id: comment.taskId },
      select: { projectId: true },
    });

    const rawUpdated = await client.taskComment.update({
      where: { id: commentId },
      data: {
        content: dto.content,
        editedAt: new Date(),
      },
      include: {
        author: { select: USER_SUMMARY_SELECT },
      },
    });

    const updated = { ...rawUpdated, author: mapUserWithAvatar(rawUpdated.author) };

    if (task) {
      this.eventEmitter.emit('task.comment.updated', {
        tenantId,
        taskId: comment.taskId,
        projectId: task.projectId,
        commentId: comment.id,
        comment: updated,
        actorId: userId,
      });
    }

    return updated;
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

    const task = await client.task.findUnique({
      where: { id: comment.taskId },
      select: { projectId: true },
    });

    await client.taskComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });

    if (task) {
      this.eventEmitter.emit('task.comment.deleted', {
        tenantId,
        taskId: comment.taskId,
        projectId: task.projectId,
        commentId: comment.id,
        actorId: userId,
      });
    }

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

    const task = await client.task.findUnique({
      where: { id: comment.taskId },
      select: { projectId: true },
    });

    let reaction;
    try {
      reaction = await client.taskCommentReaction.create({
        data: { commentId, userId, emoji },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Reaction already exists — return idempotently
        reaction = await client.taskCommentReaction.findUnique({
          where: { commentId_userId_emoji: { commentId, userId, emoji } },
        });
      } else {
        throw e;
      }
    }

    if (task) {
      this.eventEmitter.emit('task.comment.reaction.added', {
        tenantId,
        taskId: comment.taskId,
        projectId: task.projectId,
        commentId: comment.id,
        emoji,
        userId,
      });
    }

    return reaction;
  }

  async removeReaction(
    tenantId: string,
    commentId: string,
    userId: string,
    emoji: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const comment = await client.taskComment.findFirst({
      where: { id: commentId, deletedAt: null },
      select: { id: true, taskId: true },
    });

    await client.taskCommentReaction.deleteMany({
      where: { commentId, userId, emoji },
    });

    if (comment) {
      const task = await client.task.findUnique({
        where: { id: comment.taskId },
        select: { projectId: true },
      });

      if (task) {
        this.eventEmitter.emit('task.comment.reaction.removed', {
          tenantId,
          taskId: comment.taskId,
          projectId: task.projectId,
          commentId: comment.id,
          emoji,
          userId,
        });
      }
    }

    return { message: 'Reaccion removida' };
  }
}
