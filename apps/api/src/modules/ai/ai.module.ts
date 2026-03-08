import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FilesModule } from '../files/files.module';
import { LinkedInModule } from '../linkedin/linkedin.module';
import { AiConfigService } from './services/ai-config.service';
import { GeminiConfigService } from './services/gemini-config.service';
import { ActiveStreamsRegistry } from './services/active-streams.registry';
import { BackgroundQueueService } from './services/background-queue.service';
import { ChatService } from './services/chat.service';
import { MemoryService } from './services/memory.service';
import { SkillsService } from './services/skills.service';
import { ToolExecutor } from './tools/tool-executor';
import { AiConfigController } from './controllers/ai-config.controller';
import { GeminiConfigController } from './controllers/gemini-config.controller';
import { ChatController } from './controllers/chat.controller';
import { MemoryController } from './controllers/memory.controller';
import { SkillsController } from './controllers/skills.controller';
import { EncryptionModule } from '../../common/services/encryption.module';

@Module({
  imports: [PrismaModule, AccountingModule, FilesModule, EncryptionModule, forwardRef(() => LinkedInModule)],
  controllers: [AiConfigController, GeminiConfigController, ChatController, MemoryController, SkillsController],
  providers: [ActiveStreamsRegistry, AiConfigService, GeminiConfigService, BackgroundQueueService, ChatService, MemoryService, SkillsService, ToolExecutor],
  exports: [ActiveStreamsRegistry, AiConfigService, GeminiConfigService, BackgroundQueueService, MemoryService, SkillsService],
})
export class AiModule {}
