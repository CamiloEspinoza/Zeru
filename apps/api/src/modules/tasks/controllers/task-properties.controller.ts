import {
  Controller,
  Patch,
  Delete,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TaskAccessGuard } from '../../../common/guards/task-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TaskPropertiesService } from '../services/task-properties.service';
import {
  setPropertyValueSchema,
  type SetPropertyValueDto,
} from '../../projects/dto/property.dto';

@Controller('tasks/:taskId/properties')
@UseGuards(JwtAuthGuard, TenantGuard, TaskAccessGuard)
export class TaskPropertiesController {
  constructor(
    private readonly taskPropertiesService: TaskPropertiesService,
  ) {}

  @Get()
  async getValues(
    @Param('taskId') taskId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.taskPropertiesService.getTaskPropertyValues(tenantId, taskId);
  }

  @Patch(':propertyId')
  @RequireProjectRole('MEMBER')
  async upsertValue(
    @Param('taskId') taskId: string,
    @Param('propertyId') propertyId: string,
    @Body(new ZodValidationPipe(setPropertyValueSchema))
    dto: SetPropertyValueDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.taskPropertiesService.upsertValue(
      tenantId,
      taskId,
      propertyId,
      dto,
    );
  }

  @Delete(':propertyId')
  @RequireProjectRole('MEMBER')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearValue(
    @Param('taskId') taskId: string,
    @Param('propertyId') propertyId: string,
    @CurrentTenant() tenantId: string,
  ) {
    await this.taskPropertiesService.clearValue(
      tenantId,
      taskId,
      propertyId,
    );
  }
}
