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
import { LabDiagnosticReportService } from '../services/lab-diagnostic-report.service';
import {
  updateMacroscopySchema,
  completeMacroscopySchema,
  registerMacroSignerSchema,
  labReportSearchSchema,
  type UpdateMacroscopySchema,
  type CompleteMacroscopySchema,
  type RegisterMacroSignerSchema,
  type LabReportSearchSchema,
} from '../dto/lab-diagnostic-report.dto';

@Controller('lab/diagnostic-reports')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabDiagnosticReportController {
  constructor(private readonly service: LabDiagnosticReportService) {}

  @Get()
  @RequirePermission('lab', 'read')
  search(
    @CurrentTenant() tenantId: string,
    @Query(new ZodValidationPipe(labReportSearchSchema))
    query: LabReportSearchSchema,
  ) {
    return this.service.search(tenantId, query);
  }

  @Get(':id')
  @RequirePermission('lab', 'read')
  findById(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.service.findById(id, tenantId);
  }

  @Patch(':id/macroscopy')
  @RequirePermission('lab', 'write')
  updateMacroscopy(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(updateMacroscopySchema))
    body: UpdateMacroscopySchema,
  ) {
    return this.service.updateMacroscopy(id, tenantId, body);
  }

  @Post(':id/macroscopy/complete')
  @RequirePermission('lab', 'write')
  completeMacroscopy(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(completeMacroscopySchema))
    body: CompleteMacroscopySchema,
  ) {
    return this.service.completeMacroscopy(id, tenantId, body);
  }

  @Post('macro-signer')
  @RequirePermission('lab', 'write')
  registerMacroSigner(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(registerMacroSignerSchema))
    body: RegisterMacroSignerSchema,
  ) {
    return this.service.registerMacroSigner(tenantId, body);
  }
}
