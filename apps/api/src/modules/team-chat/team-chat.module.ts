import { Module } from '@nestjs/common';
import { TeamChatService } from './team-chat.service';
import { TeamChatController } from './team-chat.controller';

@Module({
  controllers: [TeamChatController],
  providers: [TeamChatService],
  exports: [TeamChatService],
})
export class TeamChatModule {}
