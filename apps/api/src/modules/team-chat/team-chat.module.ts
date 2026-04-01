import { Module } from '@nestjs/common';
import { TeamChatService } from './team-chat.service';
import { TeamChatController } from './team-chat.controller';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [TeamChatController],
  providers: [TeamChatService],
  exports: [TeamChatService],
})
export class TeamChatModule {}
