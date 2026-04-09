import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PROJECT_MIN_ROLE_KEY,
  ProjectMinRole,
} from '../decorators/project-role.decorator';
import { SKIP_TASK_ACCESS_GUARD_KEY } from '../decorators/skip-task-access.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

/**
 * Guards routes that operate on tasks.
 *
 * Resolves the relevant projectId(s) from the request:
 * - `params.id` or `params.taskId` → load task → projectId
 * - `body.projectId` (POST /tasks)
 * - `body.taskIds` (POST /tasks/bulk-update) → load tasks → distinct projectIds
 *
 * Then enforces project membership for all resolved projects, honoring
 * `@RequireProjectRole()` for write/admin operations and treating PUBLIC
 * projects as accessible to any tenant member when no role is required.
 *
 * Routes can opt out via `@SkipTaskAccessGuard()` (e.g. cross-project lists
 * like `GET /tasks/my`).
 */
@Injectable()
export class TaskAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(
      SKIP_TASK_ACCESS_GUARD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skip) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    const tenantId: string | undefined = request.tenantId;

    if (!userId || !tenantId) {
      throw new ForbiddenException('Missing user or tenant context');
    }

    const requiredRole = this.reflector.getAllAndOverride<
      ProjectMinRole | undefined
    >(PROJECT_MIN_ROLE_KEY, [context.getHandler(), context.getClass()]);

    const projectIds = await this.resolveProjectIds(request, tenantId);

    if (projectIds.length === 0) {
      // No project context resolvable — deny by default. Routes that
      // legitimately have no single-project context must opt out via
      // @SkipTaskAccessGuard().
      throw new ForbiddenException('No se pudo determinar el proyecto');
    }

    for (const projectId of projectIds) {
      await this.assertProjectAccess(projectId, tenantId, userId, requiredRole);
    }

    return true;
  }

  private async resolveProjectIds(
    request: {
      params?: Record<string, string>;
      body?: Record<string, unknown>;
    },
    tenantId: string,
  ): Promise<string[]> {
    const params = request.params ?? {};
    const body = (request.body ?? {}) as Record<string, unknown>;

    const taskId = params.taskId || params.id;

    // POST /tasks/bulk-update
    if (Array.isArray(body.taskIds) && body.taskIds.length > 0) {
      const ids = (body.taskIds as unknown[]).filter(
        (v): v is string => typeof v === 'string',
      );
      if (ids.length === 0) return [];
      const tasks = await (this.prisma as any).task.findMany({
        where: { id: { in: ids }, tenantId, deletedAt: null },
        select: { projectId: true },
      });
      const distinct = new Set<string>(
        (tasks as Array<{ projectId: string }>).map((t) => t.projectId),
      );
      // If any IDs missing → fail (likely cross-tenant or non-existent)
      if (distinct.size === 0 || tasks.length !== ids.length) {
        throw new NotFoundException('Una o más tareas no existen');
      }
      return Array.from(distinct);
    }

    // POST /tasks (create) — projectId in body
    if (!taskId && typeof body.projectId === 'string') {
      return [body.projectId];
    }

    // Routes with a task id in the URL
    if (taskId) {
      const task = await (this.prisma as any).task.findFirst({
        where: { id: taskId, tenantId, deletedAt: null },
        select: { projectId: true },
      });
      if (!task) {
        throw new NotFoundException(`Tarea ${taskId} no encontrada`);
      }
      return [task.projectId];
    }

    return [];
  }

  private async assertProjectAccess(
    projectId: string,
    tenantId: string,
    userId: string,
    requiredRole: ProjectMinRole | undefined,
  ): Promise<void> {
    const project = await (this.prisma as any).project.findFirst({
      where: { id: projectId, tenantId, deletedAt: null },
      select: { visibility: true },
    });

    if (!project) {
      throw new NotFoundException('Proyecto no encontrado');
    }

    const member = await (this.prisma as any).projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    // No role requirement and public project → any tenant member can read
    if (!requiredRole && project.visibility === 'PUBLIC') {
      return;
    }

    if (!member) {
      throw new ForbiddenException('No eres miembro de este proyecto');
    }

    if (requiredRole) {
      if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredRole]) {
        throw new ForbiddenException(
          'Permisos insuficientes en este proyecto',
        );
      }
    }
  }
}
