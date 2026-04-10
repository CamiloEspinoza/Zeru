import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabLiquidationService } from '../services/lab-liquidation.service';
import {
  createLiquidationSchema,
  confirmLiquidationSchema,
  invoiceLiquidationSchema,
  paymentLiquidationSchema,
  labLiquidationListSchema,
  type CreateLiquidationSchema,
  type ConfirmLiquidationSchema,
  type InvoiceLiquidationSchema,
  type PaymentLiquidationSchema,
  type LabLiquidationListSchema,
} from '../dto/lab-liquidation.dto';

@Controller('lab/liquidations')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabLiquidationController {
  constructor(private readonly service: LabLiquidationService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labLiquidationListSchema))
    query: LabLiquidationListSchema,
  ) {
    return this.service.findAll(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  @RequirePermission('lab', 'write')
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createLiquidationSchema))
    body: CreateLiquidationSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Post(':id/confirm')
  @RequirePermission('lab', 'write')
  confirm(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(confirmLiquidationSchema))
    body: ConfirmLiquidationSchema,
  ) {
    return this.service.confirm(id, tenantId, body);
  }

  @Post(':id/invoice')
  @RequirePermission('lab', 'write')
  invoice(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(invoiceLiquidationSchema))
    body: InvoiceLiquidationSchema,
  ) {
    return this.service.invoice(id, tenantId, body);
  }

  @Post(':id/payment')
  @RequirePermission('lab', 'write')
  registerPayment(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(paymentLiquidationSchema))
    body: PaymentLiquidationSchema,
  ) {
    return this.service.registerPayment(id, tenantId, body);
  }

  @Post(':id/cancel')
  @RequirePermission('lab', 'write')
  cancel(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.cancel(id, tenantId);
  }
}
