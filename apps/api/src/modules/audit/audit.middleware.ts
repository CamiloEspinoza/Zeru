import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RequestContext } from './request-context';

@Injectable()
export class AuditContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    const tenantId =
      (req as any).tenantId ||
      (req.headers['x-tenant-id'] as string) ||
      'unknown';

    RequestContext.run(
      {
        actorType: 'USER',
        actorId: user?.id ?? null,
        tenantId,
        source: 'web',
        ipAddress: req.ip ?? undefined,
        userAgent: req.headers['user-agent'] ?? undefined,
      },
      () => next(),
    );
  }
}
