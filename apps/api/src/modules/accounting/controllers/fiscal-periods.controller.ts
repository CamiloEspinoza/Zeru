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
  createFiscalPeriodSchema,
  type CreateFiscalPeriodSchema,
} from '@zeru/shared';
import { FiscalPeriodsService } from '../services/fiscal-periods.service';

@Controller('accounting/fiscal-periods')
@UseGuards(JwtAuthGuard, TenantGuard)
export class FiscalPeriodsController {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.fiscalPeriodsService.findAll(tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createFiscalPeriodSchema))
    body: CreateFiscalPeriodSchema,
  ) {
    return this.fiscalPeriodsService.create(tenantId, body);
  }

  @Patch(':id/close')
  close(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.fiscalPeriodsService.close(id, tenantId);
  }
}
