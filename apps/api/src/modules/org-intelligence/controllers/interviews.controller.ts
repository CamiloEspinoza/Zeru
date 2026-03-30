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
    private readonly pipelineEvents: PipelineEventsService,
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
  ) {
    return this.pipeline.launch(tenantId, id);
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

  /**
   * SSE endpoint for real-time pipeline progress.
   * Returns 200 + event-stream if the pipeline is active, or 204 if not.
   *
   * Uses manual @Res() handling — errors must be caught before writing
   * headers to avoid NestJS "callback.apply is not a function" crash
   * (exception filters are bypassed when @Res() is used).
   */
  @Get(':id/pipeline-events')
  pipelineEvents(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    // Validate interview ownership first — catch errors manually because
    // @Res() disables NestJS exception filters.
    this.interviewsService
      .findOne(tenantId, id)
      .then(() => {
        const subject = this.pipelineEvents.get(id);
        if (!subject) {
          // No active pipeline — client should rely on DB state
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

        res.on('close', () => {
          subscription.unsubscribe();
        });
      })
      .catch((err) => {
        const status = err?.status ?? err?.getStatus?.() ?? 500;
        const message = err?.message ?? 'Error interno';
        if (!res.headersSent) {
          res.status(status).json({ statusCode: status, message });
        }
      });
  }
}
