import { SetMetadata } from '@nestjs/common';
import type { ApiKeyScope } from '@zeru/shared';

export const SCOPE_KEY = 'api_key_scope';
export const RequireScope = (scope: ApiKeyScope) =>
  SetMetadata(SCOPE_KEY, scope);
