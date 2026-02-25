import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SCOPE_KEY } from '../decorators/require-scope.decorator';

@Injectable()
export class ApiKeyScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScope = this.reflector.getAllAndOverride<string>(SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredScope) return true;

    const request = context.switchToHttp().getRequest();
    const scopes: string[] = request.apiKeyScopes ?? [];

    if (!scopes.includes(requiredScope)) {
      throw new ForbiddenException(
        `This API key does not have the required scope: ${requiredScope}`,
      );
    }

    return true;
  }
}
