import { Controller, Get, Put, Post, Delete, Body, HttpCode, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { StorageConfigService } from './storage-config.service';
import {
  upsertStorageConfigSchema,
  validateStorageConfigSchema,
  type UpsertStorageConfigDto,
  type ValidateStorageConfigDto,
} from './dto';

@Controller('storage/config')
@UseGuards(JwtAuthGuard, TenantGuard)
export class StorageConfigController {
  constructor(private readonly storageConfigService: StorageConfigService) {}

  @Get()
  async getConfig(@CurrentTenant() tenantId: string) {
    const config = await this.storageConfigService.getConfig(tenantId);
    return config ?? { hasCredentials: false };
  }

  @Post('validate')
  async validate(
    @Body(new ZodValidationPipe(validateStorageConfigSchema)) body: ValidateStorageConfigDto,
  ) {
    return this.storageConfigService.validateCredentials(body);
  }

  @Put()
  async upsertConfig(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(upsertStorageConfigSchema)) body: UpsertStorageConfigDto,
  ) {
    return this.storageConfigService.upsert(tenantId, body);
  }

  @Delete()
  @HttpCode(204)
  async deleteConfig(@CurrentTenant() tenantId: string) {
    await this.storageConfigService.deleteConfig(tenantId);
  }
}
