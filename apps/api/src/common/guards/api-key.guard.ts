import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeysService } from '../../modules/api-keys/api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];

    if (!authHeader?.startsWith('Bearer zk_')) {
      throw new UnauthorizedException('Valid API key required');
    }

    const rawKey = authHeader.slice('Bearer '.length).trim();
    const result = await this.apiKeysService.validate(rawKey);

    if (!result) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    // Attach context — same shape expected by @CurrentTenant and scope guard
    request.tenantId = result.tenantId;
    request.apiKeyId = result.id;
    request.apiKeyScopes = result.scopes;

    // Fire-and-forget lastUsedAt update
    void this.apiKeysService.touch(result.id);

    return true;
  }
}
