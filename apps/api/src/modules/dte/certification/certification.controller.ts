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
import {
  CertificationService,
  CertificationStage,
} from './certification.service';

@Controller('dte/certification')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard, ThrottlerGuard)
export class CertificationController {
  constructor(private readonly service: CertificationService) {}

  @Get('status')
  @SkipThrottle()
  @RequirePermission('invoicing', 'manage-config')
  getStatus(@CurrentTenant() tenantId: string) {
    return this.service.getStatus(tenantId);
  }

  @Post('stage1')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-config')
  startStage1(@CurrentTenant() tenantId: string) {
    return this.service.startStage1(tenantId);
  }

  @Post('stage2')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-config')
  startStage2(@CurrentTenant() tenantId: string) {
    return this.service.startStage2(tenantId);
  }

  @Post('advance')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-config')
  advance(
    @CurrentTenant() tenantId: string,
    @Body('stage') stage?: CertificationStage,
  ) {
    return this.service.markStageComplete(tenantId, stage);
  }

  @Post('reset')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @RequirePermission('invoicing', 'manage-config')
  reset(@CurrentTenant() tenantId: string) {
    return this.service.reset(tenantId);
  }
}
