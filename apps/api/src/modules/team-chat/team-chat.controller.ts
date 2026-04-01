import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import {
  createChannelSchema,
  createDmSchema,
  messagesQuerySchema,
  CreateChannelDto,
  CreateDmDto,
  MessagesQueryDto,
} from './dto/index';
import { TeamChatService } from './team-chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TeamChatController {
  constructor(private readonly teamChatService: TeamChatService) {}

  @Post('channels')
  createChannel(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createChannelSchema)) body: CreateChannelDto,
  ) {
    return this.teamChatService.createChannel(tenantId, userId, body);
  }

  @Post('dm')
  createDm(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
    @Body(new ZodValidationPipe(createDmSchema)) body: CreateDmDto,
  ) {
    return this.teamChatService.createDm(tenantId, userId, body);
  }

  @Get('channels')
  getChannels(
    @CurrentTenant() tenantId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.teamChatService.getChannels(tenantId, userId);
  }

  @Get('channels/:id')
  getChannel(
    @Param('id') channelId: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.teamChatService.getChannel(channelId, userId);
  }

  @Get('channels/:id/messages')
  getMessages(
    @Param('id') channelId: string,
    @Query(new ZodValidationPipe(messagesQuerySchema)) query: MessagesQueryDto,
  ) {
    return this.teamChatService.getMessages(
      channelId,
      query.cursor,
      query.limit,
      query.direction,
    );
  }
}
