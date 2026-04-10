import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { DeltaSyncDto } from '../dto';

interface DeltaSyncResult {
  updated: unknown[];
  deleted: string[];
  added: unknown[];
}

@Injectable()
export class TaskDeltaSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async sync(
    tenantId: string,
    userId: string,
    dto: DeltaSyncDto,
  ): Promise<DeltaSyncResult> {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify project exists and user has access
    const project = await client.project.findFirst({
      where: { id: dto.projectId, tenantId, deletedAt: null },
      select: { visibility: true },
    });
    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }
    if (project.visibility === 'PRIVATE') {
      const member = await client.projectMember.findUnique({
        where: {
          projectId_userId: { projectId: dto.projectId, userId },
        },
      });
      if (!member) {
        throw new ForbiddenException('No eres miembro de este proyecto');
      }
    }

    // Load all current tasks for the project
    const currentTasks = await client.task.findMany({
      where: { projectId: dto.projectId, deletedAt: null },
      include: {
        status: true,
        section: true,
        assignees: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatarUrl: true },
            },
          },
        },
        labels: { include: { label: true } },
        _count: { select: { subtasks: true, comments: true } },
      },
    });

    const currentIds = new Set(currentTasks.map((t) => t.id));
    const clientIds = new Set(Object.keys(dto.versions));

    // Deleted = in client but not in current
    const deleted = Array.from(clientIds).filter((id) => !currentIds.has(id));

    // Added = in current but not in client
    const added = currentTasks.filter((t) => !clientIds.has(t.id));

    // Updated = in both, current version > client version
    const updated = currentTasks.filter(
      (t) =>
        clientIds.has(t.id) && t.version > (dto.versions[t.id] ?? 0),
    );

    return { updated, deleted, added };
  }
}
