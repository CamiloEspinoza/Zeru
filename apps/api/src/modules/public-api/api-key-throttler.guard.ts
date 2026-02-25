import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext } from '@nestjs/common';

/** Rate-limits by API key ID rather than client IP */
@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const apiKeyId = req['apiKeyId'] as string | undefined;
    return apiKeyId ?? ((req['ip'] as string | undefined) ?? 'unknown');
  }

  protected async shouldSkip(_context: ExecutionContext): Promise<boolean> {
    return false;
  }
}
