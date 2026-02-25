import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { API_KEY_SCOPES, type ApiKeyScope } from '@zeru/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z
    .array(z.enum(API_KEY_SCOPES as unknown as [string, ...string[]]))
    .min(1),
});

type CreateApiKeySchema = z.infer<typeof createApiKeySchema>;

@Controller('api-keys')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.apiKeysService.list(tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createApiKeySchema)) body: CreateApiKeySchema,
  ) {
    return this.apiKeysService.generate(
      tenantId,
      userId,
      body.name,
      body.scopes as ApiKeyScope[],
    );
  }

  @Delete(':id')
  @HttpCode(204)
  async revoke(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<void> {
    await this.apiKeysService.revoke(id, tenantId);
  }
}
