import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { PermissionGuard } from '../../../common/guards/permission.guard';
import { ProjectAccessGuard } from '../../../common/guards/project-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectsService } from '../services/projects.service';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  type CreateProjectDto,
  type UpdateProjectDto,
  type ListProjectsDto,
} from '../dto';

@Controller('projects')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('projects', 'create')
  async create(
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projectsService.create(tenantId, userId, dto);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listProjectsSchema)) query: ListProjectsDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projectsService.findAll(tenantId, userId, query);
  }

  @Get(':id')
  @UseGuards(ProjectAccessGuard)
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Patch(':id')
  @UseGuards(ProjectAccessGuard)
  @RequireProjectRole('ADMIN')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projectsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard, ProjectAccessGuard)
  @RequirePermission('projects', 'delete')
  @RequireProjectRole('OWNER')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projectsService.remove(tenantId, id, userId);
  }

  @Post(':id/duplicate')
  @UseGuards(PermissionGuard, ProjectAccessGuard)
  @RequirePermission('projects', 'create')
  @RequireProjectRole('ADMIN')
  async duplicate(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.projectsService.duplicate(tenantId, id, userId);
  }
}
