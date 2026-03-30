import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { InterviewsService } from '../services/interviews.service';
import { InterviewPipelineOrchestrator } from '../services/interview-pipeline.orchestrator';
import { PipelineEventsService } from '../services/pipeline-events.service';
import { S3Service } from '../../files/s3.service';
import {
  createInterviewSchema,
  updateInterviewSchema,
  listInterviewsSchema,
  updateSpeakerSchema,
  type CreateInterviewDto,
  type UpdateInterviewDto,
  type ListInterviewsDto,
  type UpdateSpeakerDto,
} from '../dto';

@Controller('org-intelligence/interviews')
@UseGuards(JwtAuthGuard, TenantGuard)
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly pipeline: InterviewPipelineOrchestrator,
    private readonly pipelineEventsService: PipelineEventsService,
    private readonly s3: S3Service,
  ) {}

  @Post()
  async create(
    @Body(new ZodValidationPipe(createInterviewSchema)) dto: CreateInterviewDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.create(tenantId, dto);
  }

  @Get()
  async findAll(
    @Query(new ZodValidationPipe(listInterviewsSchema)) query: ListInterviewsDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.findAll(tenantId, query);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.findOne(tenantId, id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInterviewSchema)) dto: UpdateInterviewDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.update(tenantId, id, dto);
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.remove(tenantId, id);
  }

  @Post(':id/upload-audio')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 500 * 1024 * 1024 } }))
  async uploadAudio(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibio ningun archivo de audio');
    return this.interviewsService.uploadAudio(tenantId, id, file);
  }

  @Post(':id/process')
  async process(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Query('fromStep') fromStep?: string,
  ) {
    return this.pipeline.launch(tenantId, id, fromStep);
  }

  @Patch(':id/speakers')
  async updateSpeakers(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateSpeakerSchema)) dto: UpdateSpeakerDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.updateSpeakers(tenantId, id, dto);
  }

  @Get(':id/transcription')
  async getTranscription(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.getTranscription(tenantId, id);
  }

  @Get(':id/status')
  async getStatus(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.interviewsService.getStatus(tenantId, id);
  }

  @Get(':id/audio-url')
  async getAudioUrl(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
  ): Promise<{ url: string | null }> {
    const interview = await this.interviewsService.findOne(tenantId, id);
    if (!interview.audioS3Key) {
      return { url: null };
    }
    const url = await this.s3.getPresignedUrl(tenantId, interview.audioS3Key, 3600);
    return { url };
  }

  /**
   * SSE endpoint for real-time pipeline progress.
   * Uses @Res() to manage the HTTP response lifecycle manually so it
   * can return 204 when no pipeline is active or stream events.
   */
  @Get(':id/pipeline-events')
  async pipelineEvents(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res({ passthrough: false }) res: Response,
  ): Promise<void> {
    try {
      await this.interviewsService.findOne(tenantId, id);
    } catch (err) {
      const status =
        (err as { status?: number })?.status ??
        (err as { getStatus?: () => number })?.getStatus?.() ??
        500;
      res.status(status).json({
        statusCode: status,
        message: (err as Error)?.message ?? 'Error interno',
      });
      return;
    }

    const subject = this.pipelineEventsService.get(id);
    if (!subject) {
      res.status(204).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subscription = subject.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
      error: () => {
        res.end();
      },
    });

    res.on('close', () => subscription.unsubscribe());
  }
}
