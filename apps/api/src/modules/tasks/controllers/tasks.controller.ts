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
import { TasksService } from '../services/tasks.service';
import {
  createTaskSchema,
  updateTaskSchema,
  listTasksSchema,
  myTasksSchema,
  moveTaskSchema,
  bulkUpdateTasksSchema,
  createDependencySchema,
  type CreateTaskDto,
  type UpdateTaskDto,
  type ListTasksDto,
  type MyTasksDto,
  type MoveTaskDto,
  type BulkUpdateTasksDto,
  type CreateDependencyDto,
} from '../dto';

@Controller('tasks')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createTaskSchema)) dto: CreateTaskDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.create(tenantId, userId, dto);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listTasksSchema)) query: ListTasksDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.findAll(tenantId, query);
  }

  @Get('my')
  async findMyTasks(
    @Query(new ZodValidationPipe(myTasksSchema)) query: MyTasksDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.findMyTasks(tenantId, userId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.findOne(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) dto: UpdateTaskDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.remove(tenantId, id, userId);
  }

  @Post(':id/move')
  async move(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(moveTaskSchema)) dto: MoveTaskDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.move(tenantId, id, userId, dto);
  }

  @Post('bulk-update')
  async bulkUpdate(
    @Body(new ZodValidationPipe(bulkUpdateTasksSchema)) dto: BulkUpdateTasksDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.bulkUpdate(tenantId, userId, dto);
  }

  // ─── Assignees ───────────────────────────────────────────

  @Post(':id/assignees')
  async addAssignee(
    @Param('id') id: string,
    @Body('userId') assigneeId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.addAssignee(tenantId, id, userId, assigneeId);
  }

  @Delete(':id/assignees/:userId')
  async removeAssignee(
    @Param('id') id: string,
    @Param('userId') assigneeId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.tasksService.removeAssignee(tenantId, id, userId, assigneeId);
  }

  // ─── Subscribers ─────────────────────────────────────────

  @Post(':id/subscribers')
  async addSubscriber(
    @Param('id') id: string,
    @Body('userId') subscriberId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.addSubscriber(tenantId, id, subscriberId);
  }

  @Delete(':id/subscribers/:userId')
  async removeSubscriber(
    @Param('id') id: string,
    @Param('userId') subscriberId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.removeSubscriber(tenantId, id, subscriberId);
  }

  // ─── Labels ──────────────────────────────────────────────

  @Post(':id/labels')
  async addLabel(
    @Param('id') id: string,
    @Body('labelId') labelId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.addLabel(tenantId, id, labelId);
  }

  @Delete(':id/labels/:labelId')
  async removeLabel(
    @Param('id') id: string,
    @Param('labelId') labelId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.removeLabel(tenantId, id, labelId);
  }

  // ─── Dependencies ────────────────────────────────────────

  @Post(':id/dependencies')
  async addDependency(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createDependencySchema)) dto: CreateDependencyDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.addDependency(
      tenantId,
      id,
      dto.dependsOnId,
      dto.dependencyType,
    );
  }

  @Delete(':id/dependencies/:depId')
  async removeDependency(
    @Param('id') id: string,
    @Param('depId') depId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.tasksService.removeDependency(tenantId, id, depId);
  }
}
