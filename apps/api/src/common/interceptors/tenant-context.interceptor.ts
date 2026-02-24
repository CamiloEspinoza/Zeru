import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Ensures tenantId from JWT is set on the request object
 * so downstream services can access it consistently.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();

    if (request.user?.tenantId && !request.tenantId) {
      request.tenantId = request.user.tenantId;
    }

    return next.handle();
  }
}
