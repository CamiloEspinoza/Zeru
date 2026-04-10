import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LabImportOrchestratorService } from '../services/lab-import-orchestrator.service';
import { startImportSchema, type StartImportDto } from '../dto/start-import.dto';
import type { FmSourceType } from '../../filemaker/transformers/types';

@Controller('lab/import')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
export class LabImportController {
  constructor(
    private readonly orchestrator: LabImportOrchestratorService,
  ) {}

  @Post('start')
  @RequirePermission('lab', 'admin')
  async startImport(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(startImportSchema)) dto: StartImportDto,
  ) {
    const result = await this.orchestrator.startImport({
      tenantId,
      sources: dto.sources as FmSourceType[],
      dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
      dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
      batchSize: dto.batchSize,
    });

    return {
      runId: result.runId,
      totalBatches: result.totalBatches,
      message: `Import started with ${result.totalBatches} batches`,
    };
  }

  @Get('runs/:id/status')
  @RequirePermission('lab', 'admin')
  async getRunStatus(@Param('id') runId: string) {
    const status = await this.orchestrator.getRunStatus(runId);
    if (!status) throw new NotFoundException(`Import run ${runId} not found`);
    return status;
  }
}
