import { Controller, Get, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopeGuard } from '../../common/guards/api-key-scope.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { FiscalPeriodsService } from '../accounting/services/fiscal-periods.service';
import { ApiKeyThrottlerGuard } from './api-key-throttler.guard';

@Controller('v1/fiscal-periods')
@UseGuards(ApiKeyGuard, ApiKeyScopeGuard, ApiKeyThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 100 } })
export class V1FiscalPeriodsController {
  constructor(private readonly fiscalPeriods: FiscalPeriodsService) {}

  @Get()
  @RequireScope('fiscal-periods:read')
  async list(@CurrentTenant() tenantId: string) {
    const data = await this.fiscalPeriods.findAll(tenantId);
    return { object: 'list', data };
  }
}
