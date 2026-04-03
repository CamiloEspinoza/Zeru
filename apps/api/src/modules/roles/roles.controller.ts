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
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard, TenantGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  findAll(@CurrentTenant() tenantId: string) {
    return this.rolesService.findAll(tenantId);
  }

  @Get(':id')
  findOne(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.rolesService.findOne(tenantId, id);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body() body: any,
  ) {
    return this.rolesService.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.rolesService.update(tenantId, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    await this.rolesService.remove(tenantId, id);
  }
}
