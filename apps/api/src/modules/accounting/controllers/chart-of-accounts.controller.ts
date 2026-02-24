import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import {
  createAccountSchema,
  updateAccountSchema,
  type CreateAccountSchema,
  type UpdateAccountSchema,
} from '@zeru/shared';
import { ChartOfAccountsService } from '../services/chart-of-accounts.service';

@Controller('accounting/accounts')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChartOfAccountsController {
  constructor(private readonly chartOfAccountsService: ChartOfAccountsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.chartOfAccountsService.findAll(tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.chartOfAccountsService.findById(id, tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountSchema,
  ) {
    return this.chartOfAccountsService.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateAccountSchema)) body: UpdateAccountSchema,
  ) {
    return this.chartOfAccountsService.update(id, tenantId, body);
  }
}
