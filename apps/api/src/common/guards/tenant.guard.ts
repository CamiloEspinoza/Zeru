import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID is required');
    }

    if (request.user && request.user.tenantId !== tenantId) {
      throw new ForbiddenException('Tenant mismatch');
    }

    return true;
  }
}
