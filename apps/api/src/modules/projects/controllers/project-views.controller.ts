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
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectViewsService } from '../services/project-views.service';
import {
  createViewSchema,
  updateViewSchema,
  type CreateViewDto,
  type UpdateViewDto,
} from '../dto';

@Controller('projects/:projectId/views')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectViewsController {
  constructor(private readonly viewsService: ProjectViewsService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.viewsService.findAll(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('MEMBER')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createViewSchema)) dto: CreateViewDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.viewsService.create(tenantId, projectId, userId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('MEMBER')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateViewSchema)) dto: UpdateViewDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.viewsService.update(tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @RequireProjectRole('ADMIN')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.viewsService.remove(tenantId, projectId, id);
  }
}
