import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DteConfigService } from '../services/dte-config.service';
import {
  createDteConfigSchema,
  type CreateDteConfigSchema,
} from '@zeru/shared';

@Controller('dte/config')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class DteConfigController {
  constructor(private readonly service: DteConfigService) {}

  @Get()
  @RequirePermission('invoicing', 'view-config')
  get(@CurrentTenant() tenantId: string) {
    return this.service.getOptional(tenantId);
  }

  @Put()
  @RequirePermission('invoicing', 'manage-config')
  upsert(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createDteConfigSchema))
    body: CreateDteConfigSchema,
  ) {
    return this.service.upsert(tenantId, body);
  }
}
