import {
  Controller,
  Get,
  Post,
  Patch,
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
import { LabExamChargeService } from '../services/lab-exam-charge.service';
import {
  createExamChargeSchema,
  updateExamChargeSchema,
  cancelExamChargeSchema,
  assignChargeToLiquidationSchema,
  assignChargeToDirectPaymentBatchSchema,
  labChargeListSchema,
  type CreateExamChargeSchema,
  type UpdateExamChargeSchema,
  type CancelExamChargeSchema,
  type AssignChargeToLiquidationSchema,
  type AssignChargeToDirectPaymentBatchSchema,
  type LabChargeListSchema,
} from '../dto/lab-exam-charge.dto';

@Controller('lab/exam-charges')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabExamChargeController {
  constructor(private readonly service: LabExamChargeService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labChargeListSchema))
    query: LabChargeListSchema,
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
    @Body(new ZodValidationPipe(createExamChargeSchema))
    body: CreateExamChargeSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  @RequirePermission('lab', 'write')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateExamChargeSchema))
    body: UpdateExamChargeSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Post(':id/cancel')
  @RequirePermission('lab', 'write')
  cancel(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(cancelExamChargeSchema))
    body: CancelExamChargeSchema,
  ) {
    return this.service.cancel(id, tenantId, body);
  }

  @Post(':id/assign-liquidation')
  @RequirePermission('lab', 'write')
  assignToLiquidation(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(assignChargeToLiquidationSchema))
    body: AssignChargeToLiquidationSchema,
  ) {
    return this.service.assignToLiquidation(id, tenantId, body.liquidationId);
  }

  @Post(':id/assign-direct-payment')
  @RequirePermission('lab', 'write')
  assignToDirectPaymentBatch(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(assignChargeToDirectPaymentBatchSchema))
    body: AssignChargeToDirectPaymentBatchSchema,
  ) {
    return this.service.assignToDirectPaymentBatch(
      id,
      tenantId,
      body.directPaymentBatchId,
    );
  }
}
