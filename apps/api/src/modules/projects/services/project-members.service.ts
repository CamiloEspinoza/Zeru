import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AddMemberDto, UpdateMemberDto } from '../dto';

@Injectable()
export class ProjectMembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async findAll(tenantId: string, projectId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    return client.projectMember.findMany({
      where: { projectId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addMember(
    tenantId: string,
    projectId: string,
    actorId: string,
    dto: AddMemberDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const existing = await client.projectMember.findFirst({
      where: { projectId, userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException('El usuario ya es miembro del proyecto');
    }

    const member = await client.projectMember.create({
      data: {
        projectId,
        userId: dto.userId,
        role: dto.role,
        tenantId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    this.eventEmitter.emit('project.member_added', {
      tenantId,
      projectId,
      userId: dto.userId,
      role: dto.role,
      actorId,
    });

    return member;
  }

  async updateMember(
    tenantId: string,
    projectId: string,
    userId: string,
    actorId: string,
    dto: UpdateMemberDto,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const member = await client.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException(
        'No se puede cambiar el rol del propietario',
      );
    }

    return client.projectMember.update({
      where: { id: member.id },
      data: { role: dto.role },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
  }

  async removeMember(
    tenantId: string,
    projectId: string,
    userId: string,
    actorId: string,
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const member = await client.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!member) {
      throw new NotFoundException('Miembro no encontrado');
    }

    if (member.role === 'OWNER') {
      throw new BadRequestException(
        'No se puede eliminar al propietario del proyecto',
      );
    }

    await client.projectMember.delete({
      where: { id: member.id },
    });

    this.eventEmitter.emit('project.member_removed', {
      tenantId,
      projectId,
      userId,
      actorId,
    });

    return { message: 'Miembro eliminado del proyecto' };
  }
}
