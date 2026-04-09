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
import { ProjectLabelsService } from '../services/project-labels.service';
import {
  createLabelSchema,
  updateLabelSchema,
  type CreateLabelDto,
  type UpdateLabelDto,
} from '../dto';

@Controller('projects/:projectId/labels')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectLabelsController {
  constructor(private readonly labelsService: ProjectLabelsService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.labelsService.findAll(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('MEMBER')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createLabelSchema)) dto: CreateLabelDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.labelsService.create(tenantId, projectId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('MEMBER')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateLabelSchema)) dto: UpdateLabelDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.labelsService.update(tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @RequireProjectRole('ADMIN')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.labelsService.remove(tenantId, projectId, id);
  }
}
