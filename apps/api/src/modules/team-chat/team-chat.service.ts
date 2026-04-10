import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/services/redis.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateChannelDto,
  CreateDmDto,
  MessagesQueryDto,
} from './dto/index';

@Injectable()
export class TeamChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
  ) {}

  // ─── Slug helper ──────────────────────────────────────────

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // ─── Channels ─────────────────────────────────────────────

  async createChannel(
    tenantId: string,
    userId: string,
    dto: CreateChannelDto,
  ) {
    const slug = this.toSlug(dto.name);

    const channel = await this.prisma.channel.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        slug,
        type: dto.type,
        topic: dto.topic,
        description: dto.description,
        members: {
          create: [
            { userId, role: 'ADMIN' },
            ...(dto.memberIds ?? [])
              .filter((id) => id !== userId)
              .map((id) => ({ userId: id, role: 'MEMBER' })),
          ],
        },
      },
      include: { members: true },
    });

    await this.audit.log({
      entityType: 'Channel',
      entityId: channel.id,
      action: 'CREATE',
      snapshot: { name: channel.name, type: channel.type, slug: channel.slug },
      context: { actorId: userId, tenantId },
    });

    return channel;
  }

  async createDm(tenantId: string, userId: string, dto: CreateDmDto) {
    const allUserIds = Array.from(new Set([userId, ...dto.userIds]));
    const isDm = allUserIds.length === 2;

    // For 1:1 DMs, check for an existing conversation
    if (isDm) {
      const otherUserId = allUserIds.find((id) => id !== userId)!;
      const existing = await this.prisma.channel.findFirst({
        where: {
          tenantId,
          type: 'DM',
          members: {
            every: {
              userId: { in: allUserIds },
            },
          },
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        include: { members: true },
      });

      if (existing) return existing;
    }

    const channel = await this.prisma.channel.create({
      data: {
        tenantId,
        createdById: userId,
        type: isDm ? 'DM' : 'GROUP_DM',
        members: {
          create: allUserIds.map((id) => ({
            userId: id,
            role: id === userId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: { members: true },
    });

    return channel;
  }

  async getChannels(tenantId: string, userId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { type: 'PUBLIC' },
          { members: { some: { userId } } },
        ],
      },
      include: {
        _count: { select: { members: true } },
        members: {
          where: { userId },
          select: { lastReadSequence: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return channels.map((ch) => ({
      ...ch,
      memberCount: ch._count.members,
      lastReadSequence: ch.members[0]?.lastReadSequence ?? BigInt(0),
    }));
  }

  async getChannel(channelId: string, userId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!channel || channel.deletedAt) {
      throw new NotFoundException('Channel not found');
    }

    const isMember = channel.members.some((m) => m.userId === userId);
    if (channel.type !== 'PUBLIC' && !isMember) {
      throw new ForbiddenException('You are not a member of this channel');
    }

    return channel;
  }

  // ─── Messages ─────────────────────────────────────────────

  async sendMessage(
    channelId: string,
    userId: string,
    content: string,
    threadParentId?: string,
    mentionedUserIds?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Increment the channel's lastSequence atomically
      const updated = await tx.channel.update({
        where: { id: channelId },
        data: { lastSequence: { increment: 1 } },
        select: { lastSequence: true },
      });

      const sequence = updated.lastSequence;

      const message = await tx.chatMessage.create({
        data: {
          channelId,
          authorId: userId,
          content,
          sequence,
          threadParentId: threadParentId ?? null,
          mentions: mentionedUserIds?.length
            ? {
                create: mentionedUserIds.map((mentionedUserId) => ({
                  mentionedUserId,
                })),
              }
            : undefined,
        },
        include: {
          author: {
            select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
          },
          mentions: { include: { mentionedUser: { select: { id: true, firstName: true, lastName: true } } } },
          reactions: true,
        },
      });

      // If this is a thread reply, increment the parent's reply count
      if (threadParentId) {
        await tx.chatMessage.update({
          where: { id: threadParentId },
          data: {
            threadReplyCount: { increment: 1 },
            lastThreadReplyAt: new Date(),
          },
        });
      }

      return message;
    });
  }

  async getMessages(
    channelId: string,
    cursor: string | undefined,
    limit: number,
    direction: MessagesQueryDto['direction'],
  ) {
    const cursorSequence = cursor ? BigInt(cursor) : undefined;

    const messages = await this.prisma.chatMessage.findMany({
      where: {
        channelId,
        deletedAt: null,
        threadParentId: null,
        ...(cursorSequence !== undefined
          ? direction === 'before'
            ? { sequence: { lt: cursorSequence } }
            : { sequence: { gt: cursorSequence } }
          : {}),
      },
      orderBy: { sequence: direction === 'before' ? 'desc' : 'asc' },
      take: limit,
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        reactions: true,
        mentions: {
          include: {
            mentionedUser: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Return in chronological order
    return direction === 'before' ? messages.reverse() : messages;
  }

  async markRead(channelId: string, userId: string, sequence: number) {
    await this.prisma.channelMember.updateMany({
      where: { channelId, userId },
      data: { lastReadSequence: BigInt(sequence) },
    });
  }

  // ─── Reactions ────────────────────────────────────────────

  async toggleReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<'added' | 'removed'> {
    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.chatReaction.delete({
        where: { messageId_userId_emoji: { messageId, userId, emoji } },
      });
      return 'removed';
    }

    await this.prisma.chatReaction.create({
      data: { messageId, userId, emoji },
    });
    return 'added';
  }

  // ─── Edit / Delete ────────────────────────────────────────

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        author: {
          select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true },
        },
        reactions: true,
      },
    });
  }

  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
    });

    if (!message || message.deletedAt) {
      throw new NotFoundException('Message not found');
    }

    if (message.authorId !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    return this.prisma.chatMessage.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
      select: { id: true, channelId: true, deletedAt: true },
    });
  }

  // ─── Typing indicator ─────────────────────────────────────

  async setTyping(
    tenantId: string,
    channelId: string,
    userId: string,
  ): Promise<void> {
    const key = `typing:${tenantId}:${channelId}:${userId}`;
    await this.redis.set(key, '1', 'EX', 3);
  }
}
