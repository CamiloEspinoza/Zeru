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
import { LabDirectPaymentBatchService } from '../services/lab-direct-payment-batch.service';
import {
  createDirectPaymentBatchSchema,
  closeDirectPaymentBatchSchema,
  labDirectPaymentBatchListSchema,
  type CreateDirectPaymentBatchSchema,
  type CloseDirectPaymentBatchSchema,
  type LabDirectPaymentBatchListDto,
} from '../dto/lab-direct-payment-batch.dto';

@Controller('lab/direct-payment-batches')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabDirectPaymentBatchController {
  constructor(private readonly service: LabDirectPaymentBatchService) {}

  @Get()
  @RequirePermission('lab', 'read')
  list(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labDirectPaymentBatchListSchema))
    query: LabDirectPaymentBatchListDto,
  ) {
    return this.service.findAll(tenantId, query.page, query.pageSize);
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
    @Body(new ZodValidationPipe(createDirectPaymentBatchSchema))
    body: CreateDirectPaymentBatchSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Post(':id/close')
  @RequirePermission('lab', 'write')
  close(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(closeDirectPaymentBatchSchema))
    body: CloseDirectPaymentBatchSchema,
  ) {
    return this.service.close(id, tenantId, body);
  }
}
