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
import { ProjectPropertiesService } from '../services/project-properties.service';
import {
  createPropertyDefinitionSchema,
  updatePropertyDefinitionSchema,
  reorderPropertyDefinitionsSchema,
  type CreatePropertyDefinitionDto,
  type UpdatePropertyDefinitionDto,
  type ReorderPropertyDefinitionsDto,
} from '../dto/property.dto';

@Controller('projects/:projectId/properties')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectPropertiesController {
  constructor(
    private readonly propertiesService: ProjectPropertiesService,
  ) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.propertiesService.findAllDefinitions(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('MEMBER')
  async create(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(createPropertyDefinitionSchema))
    dto: CreatePropertyDefinitionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.propertiesService.createDefinition(tenantId, projectId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('MEMBER')
  async update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updatePropertyDefinitionSchema))
    dto: UpdatePropertyDefinitionDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.propertiesService.updateDefinition(
      tenantId,
      projectId,
      id,
      dto,
    );
  }

  @Delete(':id')
  @RequireProjectRole('ADMIN')
  async remove(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.propertiesService.removeDefinition(tenantId, projectId, id);
  }

  @Post('reorder')
  @RequireProjectRole('MEMBER')
  async reorder(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(reorderPropertyDefinitionsSchema))
    dto: ReorderPropertyDefinitionsDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.propertiesService.reorderDefinitions(tenantId, projectId, dto);
  }
}
