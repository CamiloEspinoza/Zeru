import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ReportsService } from '../services/reports.service';

@Controller('accounting/reports')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('trial-balance')
  trialBalance(
    @CurrentTenant() tenantId: string,
    @Query('fiscalPeriodId') fiscalPeriodId: string,
  ) {
    return this.reportsService.trialBalance(tenantId, fiscalPeriodId);
  }

  @Get('general-ledger')
  generalLedger(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.generalLedger(
      tenantId,
      accountId,
      startDate,
      endDate,
    );
  }

  @Get('income-statement')
  incomeStatement(
    @CurrentTenant() tenantId: string,
    @Query('year') year: string,
  ) {
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.incomeStatement(tenantId, yearNum);
  }

  @Get('income-statement/account-entries')
  incomeStatementAccountEntries(
    @CurrentTenant() tenantId: string,
    @Query('accountId') accountId: string,
    @Query('year') year: string,
  ) {
    const yearNum = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.reportsService.incomeStatementAccountEntries(tenantId, accountId, yearNum);
  }
}
