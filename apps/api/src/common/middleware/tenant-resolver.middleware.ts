import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TENANT_HEADER } from '@zeru/shared';

/**
 * Resolves tenant from x-tenant-id header and attaches to request.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const tenantId = req.headers[TENANT_HEADER] as string | undefined;

    if (tenantId) {
      (req as any).tenantId = tenantId;
    }

    next();
  }
}
