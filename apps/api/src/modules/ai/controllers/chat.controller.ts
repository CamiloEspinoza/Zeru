import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
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
import { ChatService } from '../services/chat.service';
import { ActiveStreamsRegistry } from '../services/active-streams.registry';
import { chatRequestSchema, type ChatRequestDto } from '../dto';
import type { ChatEvent } from '@zeru/shared';

@Controller('ai')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly activeStreams: ActiveStreamsRegistry,
  ) {}

  /**
   * SSE endpoint for streaming AI responses.
   * Uses raw Response to write server-sent events.
   */
  @Post('chat')
  async chat(
    @Body(new ZodValidationPipe(chatRequestSchema)) body: ChatRequestDto,
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
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (err) => {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: err.message ?? 'Error' })}\n\n`,
        );
        res.end();
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
    });

    res.on('close', () => {
      subscription.unsubscribe();
    });

    await this.chatService.streamChat(
      {
        userId: req.user.userId,
        tenantId,
        message: body.message,
        conversationId: body.conversationId,
        questionToolCallId: body.questionToolCallId,
        documentIds: body.documentIds,
      },
      subject,
    );
  }

  @Get('conversations')
  async getConversations(
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    return this.chatService.getConversations(req.user.userId, tenantId);
  }

  @Get('conversations/:id')
  async getConversation(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    const conv = await this.chatService.getConversation(conversationId, req.user.userId, tenantId);
    if (!conv) throw new NotFoundException('Conversacion no encontrada');
    return conv;
  }

  @Get('conversations/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
  ) {
    const messages = await this.chatService.getMessages(conversationId, req.user.userId, tenantId);
    if (!messages) throw new NotFoundException('Conversacion no encontrada');
    return messages;
  }

  /**
   * SSE reconnection endpoint. Returns 200 + stream if conversation is still processing,
   * or 204 (no content) if it has already finished.
   */
  @Get('conversations/:id/stream')
  async reconnectStream(
    @Param('id') conversationId: string,
    @Request() req: { user: { userId: string } },
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    const conv = await this.chatService.getConversation(conversationId, req.user.userId, tenantId);
    if (!conv) throw new NotFoundException('Conversacion no encontrada');

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

    const subscription = subject.subscribe({
      next: (event) => res.write(`data: ${JSON.stringify(event)}\n\n`),
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      },
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
    const result = await this.chatService.deleteConversation(
      conversationId,
      req.user.userId,
      tenantId,
    );
    if (!result) throw new NotFoundException('Conversacion no encontrada');
    return result;
  }
}
