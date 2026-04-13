import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FolioService } from '../folio/folio.service';

@Controller('dte/folios')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class FolioController {
  constructor(private readonly service: FolioService) {}

  @Get()
  @RequirePermission('invoicing', 'view-config')
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @RequirePermission('invoicing', 'manage-config')
  uploadCaf(
    @CurrentTenant() tenantId: string,
    @Body('cafXml') cafXml: string,
  ) {
    return this.service.uploadCaf(tenantId, cafXml);
  }
}
