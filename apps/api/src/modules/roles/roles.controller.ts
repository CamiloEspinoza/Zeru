import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @RequirePermission('settings', 'view')
  findAll(@CurrentTenant() tenantId: string) {
    return this.rolesService.findAll(tenantId);
  }

  @Get(':id')
  @RequirePermission('settings', 'view')
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.rolesService.findOne(tenantId, id);
  }

  @Post()
  @RequirePermission('settings', 'manage-roles')
  create(
    @CurrentTenant() tenantId: string,
    @Body() body: any,
  ) {
    return this.rolesService.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('settings', 'manage-roles')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.rolesService.update(tenantId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('settings', 'manage-roles')
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.rolesService.remove(tenantId, id);
  }
}
