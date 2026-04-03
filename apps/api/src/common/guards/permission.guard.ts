import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PERMISSION_KEY,
  type RequiredPermission,
} from '../decorators/require-permission.decorator';
import { hasPermission } from '@zeru/shared';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No permission metadata — allow access (backward compatible)
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const userId: string | undefined = request.user?.userId;
    const tenantId: string | undefined = request.user?.tenantId;

    if (!userId || !tenantId) {
      throw new ForbiddenException('Authentication required');
    }

    const membership = await (this.prisma as any).userTenant.findFirst({
      where: { userId, tenantId, isActive: true },
      include: {
        roleRef: {
          include: {
            moduleAccess: true,
            overrides: true,
          },
        },
      },
    });

    if (!membership || !membership.roleRef) {
      throw new ForbiddenException('No role assigned');
    }

    const { moduleAccess, overrides } = membership.roleRef;

    const allowed = hasPermission(
      moduleAccess.map((a: any) => ({
        moduleKey: a.moduleKey,
        accessLevel: a.accessLevel,
      })),
      overrides.map((o: any) => ({
        permission: o.permission,
        granted: o.granted,
      })),
      required.module,
      required.action,
    );

    if (!allowed) {
      throw new ForbiddenException(
        `Insufficient permissions for ${required.module}:${required.action}`,
      );
    }

    return true;
  }
}
