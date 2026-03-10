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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Subject } from 'rxjs';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../../common/guards/tenant.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LinkedInAuthService } from '../services/linkedin-auth.service';
import { LinkedInApiService } from '../services/linkedin-api.service';
import { LinkedInPostsService } from '../services/linkedin-posts.service';
import { LinkedInAgentService } from '../services/linkedin-agent.service';
import { GeminiImageService } from '../services/gemini-image.service';
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
    private readonly apiService: LinkedInApiService,
    private readonly postsService: LinkedInPostsService,
    private readonly agentService: LinkedInAgentService,
    private readonly activeStreams: ActiveStreamsRegistry,
    private readonly geminiImageService: GeminiImageService,
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

  // ─── Image Upload ───────────────────────────────────────

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentTenant() tenantId: string,
  ) {
    if (!file) throw new BadRequestException('No se recibió ningún archivo');
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException('Solo se permiten imágenes (JPEG, PNG, WEBP, GIF)');
    }
    return this.geminiImageService.uploadUserImage(
      tenantId,
      file.buffer,
      file.mimetype,
      file.originalname,
    );
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
        uploadedImage: body.uploadedImage,
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

  @Post('posts/:id/reschedule')
  async reschedulePost(
    @Param('id') postId: string,
    @Body() body: { scheduledAt: string },
    @CurrentTenant() tenantId: string,
  ) {
    if (!body.scheduledAt) throw new Error('scheduledAt is required');
    return this.postsService.reschedule(tenantId, postId, new Date(body.scheduledAt));
  }

  // ─── Session cookie (li_at) ───────────────────────────────

  @Put('session-cookie')
  async saveSessionCookie(
    @Body() body: { liAtCookie: string },
    @CurrentTenant() tenantId: string,
  ) {
    if (!body.liAtCookie?.trim()) throw new Error('liAtCookie is required');
    await this.authService.saveSessionCookie(tenantId, body.liAtCookie);
    return { saved: true };
  }

  @Get('session-cookie/status')
  async getSessionCookieStatus(@CurrentTenant() tenantId: string) {
    const has = await this.authService.hasSessionCookie(tenantId);
    return { configured: has };
  }

  // ─── Community Management OAuth ──────────────────────────

  @Post('community/setup-organization')
  async setupOrganization(
    @Body() body: { companyUrl?: string; organizationUrn?: string },
    @CurrentTenant() tenantId: string,
  ) {
    // Accept direct URN (e.g. urn:li:organization:12345)
    if (body.organizationUrn?.trim()) {
      await this.postsService.updateConfig(tenantId, { organizationUrn: body.organizationUrn.trim() });
      return { organizationUrn: body.organizationUrn.trim() };
    }

    if (!body.companyUrl?.trim()) throw new BadRequestException('companyUrl u organizationUrn son requeridos');
    const vanityMatch = body.companyUrl.match(/linkedin\.com\/company\/([a-zA-Z0-9\-_]+)/);
    if (!vanityMatch) throw new BadRequestException('URL de empresa inválida. Usa el formato: linkedin.com/company/nombre-empresa');
    const vanityName = vanityMatch[1];

    const org = await this.apiService.resolveOrganizationUrnViaVoyager(tenantId, vanityName);
    await this.postsService.updateConfig(tenantId, { organizationUrn: org.urn });
    return { organizationUrn: org.urn, displayName: org.displayName };
  }

  @Get('community/auth/url')
  getCommunityAuthUrl(@CurrentTenant() tenantId: string) {
    return { url: this.authService.getCommunityAuthUrl(tenantId) };
  }

  @Post('community/auth/callback')
  async handleCommunityCallback(
    @Body(new ZodValidationPipe(linkedInCallbackSchema)) body: LinkedInCallbackDto,
  ) {
    return this.authService.handleCommunityCallback(body.code, body.state);
  }

  @Get('community/connection')
  async getCommunityConnection(@CurrentTenant() tenantId: string) {
    const connected = await this.authService.hasCommunityConnection(tenantId);
    return { connected };
  }

  @Delete('community/connection')
  async disconnectCommunity(@CurrentTenant() tenantId: string) {
    await this.authService.disconnectCommunity(tenantId);
    return { disconnected: true };
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
