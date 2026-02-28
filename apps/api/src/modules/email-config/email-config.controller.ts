import { Controller, Get, Put, Post, Delete, Body, HttpCode, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmailConfigService } from './email-config.service';
import {
  upsertEmailConfigSchema,
  validateEmailConfigSchema,
  type UpsertEmailConfigDto,
  type ValidateEmailConfigDto,
} from './dto';

@Controller('email/config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class EmailConfigController {
  constructor(private readonly emailConfigService: EmailConfigService) {}

  @Get()
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.emailConfigService.getConfig(tenantId);
    return config ?? { hasCredentials: false };
  }

  @Post('validate')
  async validate(
    @Body(new ZodValidationPipe(validateEmailConfigSchema)) body: ValidateEmailConfigDto,
  ) {
    return this.emailConfigService.validateCredentials(body);
  }

  @Put()
  async upsertConfig(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(upsertEmailConfigSchema)) body: UpsertEmailConfigDto,
  ) {
    return this.emailConfigService.upsert(tenantId, body);
  }

  @Delete()
  @HttpCode(204)
  async deleteConfig(@CurrentTenant() tenantId: string) {
    await this.emailConfigService.deleteConfig(tenantId);
  }
}
