import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createLabOriginSchema, updateLabOriginSchema,
  type CreateLabOriginSchema, type UpdateLabOriginSchema,
} from '@zeru/shared';
import { LabOriginsService } from './lab-origins.service';

@Controller('lab-origins')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabOriginsController {
  constructor(private readonly service: LabOriginsService) {}

  @Get()
  @RequirePermission('lab-origins', 'read')
  list(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermission('lab-origins', 'read')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab-origins', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLabOriginSchema)) body: CreateLabOriginSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('lab-origins', 'write')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateLabOriginSchema)) body: UpdateLabOriginSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  @RequirePermission('lab-origins', 'write')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
