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
import { ProjectsService } from '../services/projects.service';
import {
  createSectionSchema,
  updateSectionSchema,
  reorderSectionsSchema,
  type CreateSectionDto,
  type UpdateSectionDto,
  type ReorderSectionsDto,
} from '../dto';

@Controller('projects/:projectId/sections')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectSectionsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.findSections(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('MEMBER')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createSectionSchema)) dto: CreateSectionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.createSection(tenantId, projectId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('MEMBER')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSectionSchema)) dto: UpdateSectionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.updateSection(tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @RequireProjectRole('ADMIN')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.deleteSection(tenantId, projectId, id);
  }

  @Post('reorder')
  @RequireProjectRole('MEMBER')
  async reorder(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(reorderSectionsSchema))
    dto: ReorderSectionsDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.reorderSections(tenantId, projectId, dto);
  }
}
