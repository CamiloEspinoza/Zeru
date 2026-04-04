import {
  Body, Controller, Delete, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createLegalEntitySchema, updateLegalEntitySchema,
  type CreateLegalEntitySchema, type UpdateLegalEntitySchema,
} from '@zeru/shared';
import { LegalEntitiesService } from './legal-entities.service';

@Controller('legal-entities')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LegalEntitiesController {
  constructor(private readonly service: LegalEntitiesService) {}

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
    @Body(new ZodValidationPipe(createLegalEntitySchema)) body: CreateLegalEntitySchema,
  ) {
    return this.service.create(tenantId, body);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateLegalEntitySchema)) body: UpdateLegalEntitySchema,
  ) {
    return this.service.update(id, tenantId, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentTenant() tenantId: string) {
    return this.service.delete(id, tenantId);
  }
}
