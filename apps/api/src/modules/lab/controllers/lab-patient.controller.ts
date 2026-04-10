import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabPatientService } from '../services/lab-patient.service';
import {
  labPatientSearchSchema,
  type LabPatientSearchSchema,
} from '../dto/lab-search.dto';

@Controller('lab/patients')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('lab', 'read')
export class LabPatientController {
  constructor(private readonly service: LabPatientService) {}

  @Get()
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labPatientSearchSchema))
    query: LabPatientSearchSchema,
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
