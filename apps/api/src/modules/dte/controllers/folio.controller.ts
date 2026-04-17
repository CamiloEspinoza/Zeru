import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard, Throttle, SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { FolioService } from '../folio/folio.service';

@Controller('dte/folios')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class FolioController {
  constructor(private readonly service: FolioService) {}

  @Get()
  @SkipThrottle()
  @RequirePermission('invoicing', 'view-config')
  list(@CurrentTenant() tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-caf')
  uploadCaf(
    @CurrentTenant() tenantId: string,
    @Body('cafXml') cafXml: string,
  ) {
    return this.service.uploadCaf(tenantId, cafXml);
  }
}
