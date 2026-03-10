import { Controller, Get, Put, Post, Delete, Body, HttpCode, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { GeminiConfigService } from '../services/gemini-config.service';
import { upsertGeminiConfigSchema, type UpsertGeminiConfigDto } from '../dto';

@Controller('ai/gemini-config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class GeminiConfigController {
  constructor(private readonly geminiConfigService: GeminiConfigService) {}

  @Get()
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.geminiConfigService.getConfig(tenantId);
    return config ?? { hasApiKey: false };
  }

  @Post('validate-key')
  async validateKey(
    @Body() body: { apiKey: string },
  ) {
    return this.geminiConfigService.validateKey(body.apiKey);
  }

  @Put()
  async upsertConfig(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(upsertGeminiConfigSchema)) body: UpsertGeminiConfigDto,
  ) {
    return this.geminiConfigService.upsert(tenantId, body.apiKey);
  }

  @Delete('key')
  @HttpCode(204)
  async deleteKey(@CurrentTenant() tenantId: string) {
    await this.geminiConfigService.deleteKey(tenantId);
  }
}
