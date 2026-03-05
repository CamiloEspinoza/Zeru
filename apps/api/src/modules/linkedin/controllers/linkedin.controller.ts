import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { Subject } from 'rxjs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LinkedInAuthService } from '../services/linkedin-auth.service';
import { LinkedInPostsService } from '../services/linkedin-posts.service';
import { LinkedInAgentService } from '../services/linkedin-agent.service';
import { ActiveStreamsRegistry } from '../../ai/services/active-streams.registry';
import {
  linkedInCallbackSchema,
  linkedInChatSchema,
  linkedInUpdateConfigSchema,
  linkedInListPostsSchema,
  type LinkedInCallbackDto,
  type LinkedInChatDto,
  type LinkedInUpdateConfigDto,
  type LinkedInListPostsDto,
} from '../dto';
import type { ChatEvent } from '@zeru/shared';

@Controller('linkedin')
@UseGuards(JwtAuthGuard, TenantGuard)
export class LinkedInController {
  constructor(
    private readonly authService: LinkedInAuthService,
    private readonly postsService: LinkedInPostsService,
    private readonly agentService: LinkedInAgentService,
    private readonly activeStreams: ActiveStreamsRegistry,
  ) {}

  // ─── Auth ───────────────────────────────────────────────

  @Get('auth/url')
  getAuthUrl(@CurrentTenant() tenantId: string) {
    return { url: this.authService.getAuthUrl(tenantId) };
  }

  @Post('auth/callback')
  async handleCallback(
    @Body(new ZodValidationPipe(linkedInCallbackSchema)) body: LinkedInCallbackDto,
  ) {
    return this.authService.handleCallback(body.code, body.state);
  }

  @Get('connection')
  async getConnection(@CurrentTenant() tenantId: string) {
    const connection = await this.authService.getConnection(tenantId);
    return connection ?? { connected: false };
  }

  @Delete('connection')
  async disconnect(@CurrentTenant() tenantId: string) {
    await this.authService.disconnect(tenantId);
    return { disconnected: true };
  }

  // ─── Agent Chat ──────────────────────────────────────────

  @Post('chat')
  async chat(
    @Body(new ZodValidationPipe(linkedInChatSchema)) body: LinkedInChatDto,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subject = new Subject<ChatEvent>();

    const subscription = subject.subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
      error: (err) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message ?? 'Error' })}\n\n`);
        res.end();
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
    });

    res.on('close', () => subscription.unsubscribe());

    await this.agentService.streamChat(
      {
        userId: req.user.userId,
        tenantId,
        message: body.message,
        conversationId: body.conversationId,
        questionToolCallId: body.questionToolCallId,
      },
      subject,
    );
  }

  @Get('conversations')
  async getConversations(
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    return this.agentService.getConversations(req.user.userId, tenantId);
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    const messages = await this.agentService.getMessages(conversationId, req.user.userId, tenantId);
    if (!messages) throw new NotFoundException('Conversación no encontrada');
    return messages;
  }

  @Get('conversations/:id/stream')
  async reconnectStream(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    const messages = await this.agentService.getMessages(conversationId, req.user.userId, tenantId);
    if (!messages) throw new NotFoundException('Conversación no encontrada');

    const subject = this.activeStreams.get(conversationId);
    if (!subject) {
      res.status(204).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const subscription = (subject as Subject<ChatEvent>).subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
      complete: () => { res.write('data: [DONE]\n\n'); res.end(); },
      error: () => res.end(),
    });

    res.on('close', () => subscription.unsubscribe());
  }

  @Delete('conversations/:id')
  async deleteConversation(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    const result = await this.agentService.deleteConversation(conversationId, req.user.userId, tenantId);
    if (!result) throw new NotFoundException('Conversación no encontrada');
    return result;
  }

  // ─── Posts ───────────────────────────────────────────────

  @Get('posts')
  async listPosts(
    @Query(new ZodValidationPipe(linkedInListPostsSchema)) query: LinkedInListPostsDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.postsService.list(tenantId, query);
  }

  @Post('posts/:id/publish')
  async publishPost(
    @Param('id') postId: string,
    @CurrentTenant() tenantId: string,
  ) {
    await this.postsService.publish(tenantId, postId);
    return { published: true };
  }

  @Post('posts/:id/cancel')
  async cancelPost(
    @Param('id') postId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.postsService.cancel(tenantId, postId);
  }

  // ─── Config ──────────────────────────────────────────────

  @Get('config')
  async getConfig(@CurrentTenant() tenantId: string) {
    return this.postsService.getOrCreateConfig(tenantId);
  }

  @Put('config')
  async updateConfig(
    @Body(new ZodValidationPipe(linkedInUpdateConfigSchema)) body: LinkedInUpdateConfigDto,
    @CurrentTenant() tenantId: string,
  ) {
    return this.postsService.updateConfig(tenantId, body);
  }
}
