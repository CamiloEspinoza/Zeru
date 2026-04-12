import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TaskAccessGuard } from '../../../common/guards/task-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { TaskCommentsService } from '../services/task-comments.service';
import { S3Service } from '../../files/s3.service';
import {
  createCommentSchema,
  updateCommentSchema,
  type CreateCommentDto,
  type UpdateCommentDto,
} from '../dto';

@Controller('tasks/:taskId/comments')
@UseGuards(JwtAuthGuard, TenantGuard, TaskAccessGuard)
export class TaskCommentsController {
  constructor(
    private readonly commentsService: TaskCommentsService,
    private readonly s3Service: S3Service,
  ) {}

  @Get()
  async findAll(
    @Param('taskId') taskId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.commentsService.findAll(tenantId, taskId);
  }

  @Post()
  @RequireProjectRole('MEMBER')
  async create(
    @Param('taskId') taskId: string,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.create(tenantId, taskId, userId, dto);
  }

  @Patch(':id')
  @RequireProjectRole('MEMBER')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateCommentSchema)) dto: UpdateCommentDto,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.update(tenantId, id, userId, dto);
  }

  @Delete(':id')
  @RequireProjectRole('MEMBER')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.remove(tenantId, id, userId);
  }

  @Post(':id/reactions')
  @RequireProjectRole('MEMBER')
  async addReaction(
    @Param('id') id: string,
    @Body('emoji') emoji: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.addReaction(tenantId, id, userId, emoji);
  }

  @Delete(':id/reactions/:emoji')
  @RequireProjectRole('MEMBER')
  async removeReaction(
    @Param('id') id: string,
    @Param('emoji') emoji: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.commentsService.removeReaction(tenantId, id, userId, emoji);
  }

  /**
   * Upload a file attachment for a task comment.
   * Returns presigned URL + metadata to embed in the comment content.
   */
  @Post('upload')
  @RequireProjectRole('MEMBER')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadAttachment(
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');

    const fileId = randomUUID();
    const s3Key = `tenants/${tenantId}/task-attachments/${taskId}/${fileId}/${file.originalname}`;

    await this.s3Service.upload(tenantId, s3Key, file.buffer, file.mimetype);

    const url = await this.s3Service.getPresignedUrl(tenantId, s3Key, 7 * 24 * 3600);

    return {
      url,
      s3Key,
      filename: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }
}
