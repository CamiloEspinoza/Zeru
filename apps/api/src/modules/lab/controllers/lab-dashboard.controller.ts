import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { LabDashboardService } from '../services/lab-dashboard.service';

@Controller('lab/dashboard')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabDashboardController {
  constructor(private readonly dashboard: LabDashboardService) {}

  @Get('status-summary')
  @RequirePermission('lab', 'read')
  getStatusSummary(
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboard.getStatusSummary(tenantId, dateFrom, dateTo);
  }

  @Get('volume-trends')
  @RequirePermission('lab', 'read')
  getVolumeTrends(
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('granularity') granularity?: string,
  ) {
    if (!dateFrom || !dateTo) {
      const now = new Date();
      const from = new Date(now);
      from.setDate(from.getDate() - 14);
      dateFrom = dateFrom ?? from.toISOString();
      dateTo = dateTo ?? now.toISOString();
    }
    return this.dashboard.getVolumeTrends(
      tenantId,
      dateFrom,
      dateTo,
      granularity,
    );
  }

  @Get('turnaround')
  @RequirePermission('lab', 'read')
  getTurnaround(
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboard.getTurnaround(tenantId, dateFrom, dateTo);
  }

  @Get('financial-summary')
  @RequirePermission('lab', 'view-financial')
  getFinancialSummary(
    @CurrentTenant() tenantId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.dashboard.getFinancialSummary(tenantId, dateFrom, dateTo);
  }
}
