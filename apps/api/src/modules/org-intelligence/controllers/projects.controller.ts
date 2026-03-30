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
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { ProjectsService } from '../services/projects.service';
import { InterviewQuestionsService } from '../services/interview-questions.service';
import {
  createProjectSchema,
  updateProjectSchema,
  listProjectsSchema,
  type CreateProjectDto,
  type UpdateProjectDto,
  type ListProjectsDto,
} from '../dto';

@Controller('org-intelligence/projects')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly questionsService: InterviewQuestionsService,
  ) {}

  @Post()
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
  ) {
    return this.projectsService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.findOne(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.projectsService.remove(tenantId, id);
  }

  @Get(':id/knowledge-summary')
  async getKnowledgeSummary(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.questionsService.getKnowledgeSummary(tenantId, id);
  }
}
