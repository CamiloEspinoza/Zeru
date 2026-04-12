import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { TaskAccessGuard } from '../../../common/guards/task-access.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireProjectRole } from '../../../common/decorators/project-role.decorator';
import { TaskAttachmentsService } from '../services/task-attachments.service';

@Controller('tasks/:taskId/attachments')
@UseGuards(JwtAuthGuard, TenantGuard, TaskAccessGuard)
export class TaskAttachmentsController {
  constructor(
    private readonly attachmentsService: TaskAttachmentsService,
  ) {}

  @Post()
  @RequireProjectRole('MEMBER')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }),
  )
  async upload(
    @Param('taskId') taskId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    return this.attachmentsService.upload(tenantId, taskId, userId, file);
  }

  @Get()
  async findAll(
    @Param('taskId') taskId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.attachmentsService.findAll(tenantId, taskId);
  }

  @Delete(':attachmentId')
  @RequireProjectRole('MEMBER')
  async remove(
    @Param('attachmentId') attachmentId: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.attachmentsService.remove(tenantId, attachmentId, userId);
  }
}
