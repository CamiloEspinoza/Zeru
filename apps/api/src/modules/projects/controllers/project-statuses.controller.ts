import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { ProjectAccessGuard } from '../../../common/guards/project-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectStatusesService } from '../services/project-statuses.service';
import {
  createStatusConfigSchema,
  updateStatusConfigSchema,
  reorderStatusesSchema,
  type CreateStatusConfigDto,
  type UpdateStatusConfigDto,
  type ReorderStatusesDto,
} from '../dto';

@Controller('projects/:projectId/statuses')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectStatusesController {
  constructor(private readonly statusesService: ProjectStatusesService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.statusesService.findAll(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('ADMIN')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createStatusConfigSchema))
    dto: CreateStatusConfigDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.statusesService.create(tenantId, projectId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('ADMIN')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStatusConfigSchema))
    dto: UpdateStatusConfigDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.statusesService.update(tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @RequireProjectRole('ADMIN')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.statusesService.remove(tenantId, projectId, id);
  }

  @Post('reorder')
  @RequireProjectRole('ADMIN')
  async reorder(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(reorderStatusesSchema))
    dto: ReorderStatusesDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.statusesService.reorder(tenantId, projectId, dto);
  }
}
