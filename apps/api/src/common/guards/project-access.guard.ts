import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PROJECT_MIN_ROLE_KEY, ProjectMinRole } from '../decorators/project-role.decorator';

const ROLE_HIERARCHY: Record<string, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
};

@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;
    const tenantId = request.tenantId;

    const projectId =
      request.params?.projectId || request.params?.id || request.body?.projectId;

    if (!projectId || !userId) {
      throw new ForbiddenException('Missing project or user context');
    }

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

    const requiredRole = this.reflector.getAllAndOverride<ProjectMinRole | undefined>(
      PROJECT_MIN_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No role requirement and public project: allow any tenant member
    if (!requiredRole && project.visibility === 'PUBLIC') {
      return true;
    }

    if (!member) {
      throw new ForbiddenException('No eres miembro de este proyecto');
    }

    if (requiredRole) {
      if (ROLE_HIERARCHY[member.role] < ROLE_HIERARCHY[requiredRole]) {
        throw new ForbiddenException('Permisos insuficientes en este proyecto');
      }
    }

    return true;
  }
}
