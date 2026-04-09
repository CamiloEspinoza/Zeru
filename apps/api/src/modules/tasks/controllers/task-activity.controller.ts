import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TaskAccessGuard } from '../../../common/guards/task-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TaskActivityService } from '../services/task-activity.service';
import { activityQuerySchema, type ActivityQueryDto } from '../dto';

@Controller('tasks/:taskId/activity')
@UseGuards(JwtAuthGuard, TenantGuard, TaskAccessGuard)
export class TaskActivityController {
  constructor(private readonly activityService: TaskActivityService) {}

  @Get()
  async findAll(
    @Param('taskId') taskId: string,
    @Query(new ZodValidationPipe(activityQuerySchema)) query: ActivityQueryDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.activityService.findByTask(tenantId, taskId, query);
  }
}
