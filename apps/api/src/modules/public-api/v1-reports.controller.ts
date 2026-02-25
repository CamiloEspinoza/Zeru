import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopeGuard } from '../../common/guards/api-key-scope.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ReportsService } from '../accounting/services/reports.service';
import { ApiKeyThrottlerGuard } from './api-key-throttler.guard';

@Controller('v1/reports')
@UseGuards(ApiKeyGuard, ApiKeyScopeGuard, ApiKeyThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 100 } })
export class V1ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('trial-balance')
  @RequireScope('reports:read')
  async trialBalance(
    @CurrentTenant() tenantId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
  ) {
    const data = await this.reports.trialBalance(tenantId, fiscalPeriodId);
    return { object: 'list', data };
  }

  @Get('general-ledger')
  @RequireScope('reports:read')
  async generalLedger(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const data = await this.reports.generalLedger(
      tenantId,
      accountId,
      startDate,
      endDate,
    );
    return { object: 'list', data };
  }

  @Get('income-statement')
  @RequireScope('reports:read')
  async incomeStatement(
    @CurrentTenant() tenantId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string | undefined,
    @Query('year') year: string,
  ) {
    const opts = fiscalPeriodId
      ? { fiscalPeriodId }
      : { year: year ? parseInt(year, 10) : new Date().getFullYear() };
    const data = await this.reports.incomeStatement(tenantId, opts);
    return { object: 'list', data };
  }
}
