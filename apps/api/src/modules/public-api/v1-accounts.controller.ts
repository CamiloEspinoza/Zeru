import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { ApiKeyScopeGuard } from '../../common/guards/api-key-scope.guard';
import { RequireScope } from '../../common/decorators/require-scope.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { ChartOfAccountsService } from '../accounting/services/chart-of-accounts.service';
import { ApiKeyThrottlerGuard } from './api-key-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { createAccountSchema, type CreateAccountSchema } from '@zeru/shared';

@Controller('v1/accounts')
@UseGuards(ApiKeyGuard, ApiKeyScopeGuard, ApiKeyThrottlerGuard)
@Throttle({ default: { ttl: 60_000, limit: 100 } })
export class V1AccountsController {
  constructor(private readonly chartOfAccounts: ChartOfAccountsService) {}

  @Get()
  @RequireScope('accounts:read')
  async list(@CurrentTenant() tenantId: string) {
    const data = await this.chartOfAccounts.findAll(tenantId);
    return { object: 'list', data };
  }

  @Get(':id')
  @RequireScope('accounts:read')
  async getOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    const data = await this.chartOfAccounts.findById(id, tenantId);
    return { object: 'account', ...data };
  }

  @Post()
  @RequireScope('accounts:write')
  async create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountSchema,
  ) {
    const data = await this.chartOfAccounts.create(tenantId, body);
    return { object: 'account', ...data };
  }
}
