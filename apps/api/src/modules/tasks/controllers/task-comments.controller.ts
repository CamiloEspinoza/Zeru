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
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TaskCommentsService } from '../services/task-comments.service';
import {
  createCommentSchema,
  updateCommentSchema,
  type CreateCommentDto,
  type UpdateCommentDto,
} from '../dto';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TaskCommentsController {
  constructor(private readonly commentsService: TaskCommentsService) {}

  @Get()
  async findAll(
    @Param('taskId') taskId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.commentsService.findAll(tenantId, taskId);
  }

  @Post()
  async create(
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.create(tenantId, taskId, userId, dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCommentSchema)) dto: UpdateCommentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.remove(tenantId, id, userId);
  }

  @Post(':id/reactions')
  async addReaction(
    @Param('id') id: string,
    @Body('emoji') emoji: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.addReaction(tenantId, id, userId, emoji);
  }

  @Delete(':id/reactions/:emoji')
  async removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.removeReaction(tenantId, id, userId, emoji);
  }
}
