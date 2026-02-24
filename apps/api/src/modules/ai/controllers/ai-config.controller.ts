import { Controller, Get, Put, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AiConfigService } from '../services/ai-config.service';
import { upsertAiConfigSchema, validateKeySchema, type UpsertAiConfigDto, type ValidateKeyDto } from '../dto';
import { AiProvider } from '@prisma/client';

@Controller('ai/config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AiConfigController {
  constructor(private readonly aiConfigService: AiConfigService) {}

  @Get()
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.aiConfigService.getConfig(tenantId);
    return config ?? { hasApiKey: false };
  }

  @Post('validate-key')
  async validateKey(
    @Body(new ZodValidationPipe(validateKeySchema)) body: ValidateKeyDto,
  ) {
    return this.aiConfigService.validateKey(body.provider, body.apiKey);
  }

  @Put()
  async upsertConfig(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(upsertAiConfigSchema)) body: UpsertAiConfigDto,
  ) {
    return this.aiConfigService.upsert(tenantId, {
      provider: body.provider as AiProvider,
      apiKey: body.apiKey,
      model: body.model,
    });
  }
}
