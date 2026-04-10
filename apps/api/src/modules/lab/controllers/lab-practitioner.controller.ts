import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabPractitionerService } from '../services/lab-practitioner.service';
import {
  labPractitionerSearchSchema,
  type LabPractitionerSearchSchema,
} from '../dto/lab-search.dto';

@Controller('lab/practitioners')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('lab', 'read')
export class LabPractitionerController {
  constructor(private readonly service: LabPractitionerService) {}

  @Get()
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labPractitionerSearchSchema))
    query: LabPractitionerSearchSchema,
  ) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }
}
