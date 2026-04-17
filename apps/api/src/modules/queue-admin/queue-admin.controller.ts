import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { QueueAdminService } from './queue-admin.service';

const VALID_STATUSES = ['waiting', 'active', 'completed', 'failed', 'delayed'] as const;
type JobStatus = (typeof VALID_STATUSES)[number];

@Controller('admin/queues')
@UseGuards(JwtAuthGuard, TenantGuard, PermissionGuard)
@RequirePermission('admin', 'view-costs')
export class QueueAdminController {
  constructor(private readonly queueAdmin: QueueAdminService) {}

  @Get()
  async listQueues() {
    return this.queueAdmin.getAllStats();
  }

  @Get(':name/jobs')
  async listJobs(
    @Param('name') name: string,
    @Query('status') status: string = 'active',
    @Query('page') page: string = '1',
    @Query('perPage') perPage: string = '20',
  ) {
    if (!VALID_STATUSES.includes(status as JobStatus)) {
      throw new BadRequestException(
        `Invalid status. Valid: ${VALID_STATUSES.join(', ')}`,
      );
    }

    return this.queueAdmin.getJobs(
      name,
      status as JobStatus,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(perPage, 10) || 20)),
    );
  }

  @Get(':name/jobs/:jobId')
  async getJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
  ) {
    const job = await this.queueAdmin.getJob(name, jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    return job;
  }

  @Post(':name/jobs/:jobId/retry')
  async retryJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
  ) {
    await this.queueAdmin.retryJob(name, jobId);
    return { message: 'Job queued for retry' };
  }

  @Post(':name/retry-all')
  async retryAllFailed(@Param('name') name: string) {
    const count = await this.queueAdmin.retryAllFailed(name);
    return { retriedCount: count };
  }

  @Post(':name/clean')
  async clean(
    @Param('name') name: string,
    @Query('status') status: string = 'completed',
  ) {
    if (status !== 'completed' && status !== 'failed') {
      throw new BadRequestException('Can only clean completed or failed jobs');
    }
    const count = await this.queueAdmin.cleanJobs(name, status);
    return { removedCount: count };
  }

  @Post(':name/pause')
  async pause(@Param('name') name: string) {
    await this.queueAdmin.pauseQueue(name);
    return { message: 'Queue paused' };
  }

  @Post(':name/resume')
  async resume(@Param('name') name: string) {
    await this.queueAdmin.resumeQueue(name);
    return { message: 'Queue resumed' };
  }

  @Delete(':name/jobs/:jobId')
  async removeJob(
    @Param('name') name: string,
    @Param('jobId') jobId: string,
  ) {
    await this.queueAdmin.removeJob(name, jobId);
    return { message: 'Job removed' };
  }
}
