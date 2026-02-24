import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { FilesModule } from '../files/files.module';
import { AiConfigService } from './services/ai-config.service';
import { ChatService } from './services/chat.service';
import { ToolExecutor } from './tools/tool-executor';
import { AiConfigController } from './controllers/ai-config.controller';
import { ChatController } from './controllers/chat.controller';

@Module({
  imports: [PrismaModule, AccountingModule, FilesModule],
  controllers: [AiConfigController, ChatController],
  providers: [AiConfigService, ChatService, ToolExecutor],
  exports: [AiConfigService],
})
export class AiModule {}
