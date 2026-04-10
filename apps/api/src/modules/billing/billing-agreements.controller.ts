import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createBillingAgreementSchema, updateBillingAgreementSchema,
  createBillingAgreementLineSchema, createBillingContactSchema,
  type CreateBillingAgreementSchema, type UpdateBillingAgreementSchema,
  type CreateBillingAgreementLineSchema, type CreateBillingContactSchema,
} from '@zeru/shared';
import { BillingAgreementsService } from './billing-agreements.service';

@Controller('billing-agreements')
@UseGuards(JwtAuthGuard, TenantGuard)
export class BillingAgreementsController {
  constructor(private readonly service: BillingAgreementsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.service.findAll(tenantId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.findById(id, tenantId);
  }

  @Post()
  create(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createBillingAgreementSchema)) body: CreateBillingAgreementSchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateBillingAgreementSchema)) body: UpdateBillingAgreementSchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }

  @Post(':id/lines')
  addLine(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createBillingAgreementLineSchema)) body: CreateBillingAgreementLineSchema,
  ) {
    return this.service.addLine(id, tenantId, body);
  }

  @Post(':id/contacts')
  addContact(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(createBillingContactSchema)) body: CreateBillingContactSchema,
  ) {
    return this.service.addContact(id, tenantId, body);
  }
}
