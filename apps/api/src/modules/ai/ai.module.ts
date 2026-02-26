import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FilesModule } from '../files/files.module';
import { AiConfigService } from './services/ai-config.service';
import { ActiveStreamsRegistry } from './services/active-streams.registry';
import { BackgroundQueueService } from './services/background-queue.service';
import { ChatService } from './services/chat.service';
import { MemoryService } from './services/memory.service';
import { SkillsService } from './services/skills.service';
import { ToolExecutor } from './tools/tool-executor';
import { AiConfigController } from './controllers/ai-config.controller';
import { ChatController } from './controllers/chat.controller';
import { MemoryController } from './controllers/memory.controller';
import { SkillsController } from './controllers/skills.controller';

@Module({
  imports: [PrismaModule, AccountingModule, FilesModule],
  controllers: [AiConfigController, ChatController, MemoryController, SkillsController],
  providers: [ActiveStreamsRegistry, AiConfigService, BackgroundQueueService, ChatService, MemoryService, SkillsService, ToolExecutor],
  exports: [ActiveStreamsRegistry, AiConfigService, BackgroundQueueService, MemoryService, SkillsService],
})
export class AiModule {}
