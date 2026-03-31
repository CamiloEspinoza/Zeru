import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) throw new ForbiddenException('Authentication required');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { superAdmin: true } });

    if (!user?.superAdmin) throw new ForbiddenException('Super admin access required');

    return true;
  }
}
