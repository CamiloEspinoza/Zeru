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
import { ProjectMembersService } from '../services/project-members.service';
import {
  addMemberSchema,
  updateMemberSchema,
  type AddMemberDto,
  type UpdateMemberDto,
} from '../dto';

@Controller('projects/:projectId/members')
@UseGuards(JwtAuthGuard, TenantGuard, ProjectAccessGuard)
export class ProjectMembersController {
  constructor(private readonly membersService: ProjectMembersService) {}

  @Get()
  async findAll(
    @Param('projectId') projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.membersService.findAll(tenantId, projectId);
  }

  @Post()
  @RequireProjectRole('ADMIN')
  async addMember(
    @Param('projectId') projectId: string,
    @Body(new ZodValidationPipe(addMemberSchema)) dto: AddMemberDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.membersService.addMember(tenantId, projectId, actorId, dto);
  }

  @Patch(':userId')
  @RequireProjectRole('ADMIN')
  async updateMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) dto: UpdateMemberDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.membersService.updateMember(
      tenantId,
      projectId,
      userId,
      actorId,
      dto,
    );
  }

  @Delete(':userId')
  @RequireProjectRole('ADMIN')
  async removeMember(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') actorId: string,
  ) {
    return this.membersService.removeMember(
      tenantId,
      projectId,
      userId,
      actorId,
    );
  }
}
