import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { OrgDiagnosisService } from '../services/org-diagnosis.service';
import { OrgDiagramService } from '../services/org-diagram.service';

@Controller('org-intelligence/diagnosis')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DiagnosisController {
  constructor(
    private readonly diagnosis: OrgDiagnosisService,
    private readonly diagrams: OrgDiagramService,
  ) {}

  @Get()
  getDiagnosis(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.diagnosis.getDiagnosis(tenantId, projectId);
  }

  @Get('spof')
  getSPOFs(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.diagnosis.detectSPOFs(tenantId, projectId);
  }

  @Get('bottlenecks')
  getBottlenecks(
    @CurrentTenant() tenantId: string,
    @Query('projectId') projectId: string,
  ) {
    return this.diagnosis.detectBottlenecks(tenantId, projectId);
  }

  @Post('diagrams/process')
  generateProcessDiagram(
    @CurrentTenant() tenantId: string,
    @Body('entityId') entityId: string,
  ) {
    return this.diagrams.generateProcessDiagram(tenantId, entityId);
  }

  @Post('diagrams/org-chart')
  generateOrgChart(
    @CurrentTenant() tenantId: string,
    @Body('projectId') projectId: string,
  ) {
    return this.diagrams.generateOrgChart(tenantId, projectId);
  }

  @Post('diagrams/dependencies')
  generateDependencyMap(
    @CurrentTenant() tenantId: string,
    @Body('projectId') projectId: string,
  ) {
    return this.diagrams.generateDependencyMap(tenantId, projectId);
  }
}
