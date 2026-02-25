import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { SkillsService } from '../services/skills.service';
import {
  installSkillSchema,
  toggleSkillSchema,
  type InstallSkillDto,
  type ToggleSkillDto,
} from '../dto';

@Controller('ai/skills')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  @Get()
  list(@CurrentTenant() tenantId: string) {
    return this.skillsService.list(tenantId);
  }

  @Post()
  install(
    @CurrentTenant() tenantId: string,
    @Body(new ZodValidationPipe(installSkillSchema)) body: InstallSkillDto,
  ) {
    return this.skillsService.install(tenantId, body.repoUrl);
  }

  @Patch(':id')
  toggle(
    @CurrentTenant() tenantId: string,
    @Param('id') skillId: string,
    @Body(new ZodValidationPipe(toggleSkillSchema)) body: ToggleSkillDto,
  ) {
    return this.skillsService.toggle(tenantId, skillId, body.isActive);
  }

  @Put(':id/sync')
  sync(
    @CurrentTenant() tenantId: string,
    @Param('id') skillId: string,
  ) {
    return this.skillsService.sync(tenantId, skillId);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @CurrentTenant() tenantId: string,
    @Param('id') skillId: string,
  ) {
    await this.skillsService.remove(tenantId, skillId);
  }
}
