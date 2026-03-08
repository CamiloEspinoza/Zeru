import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionModule } from '../../common/services/encryption.module';
import { AiModule } from '../ai/ai.module';
import { LinkedInAuthService } from './services/linkedin-auth.service';
import { LinkedInApiService } from './services/linkedin-api.service';
import { GeminiImageService } from './services/gemini-image.service';
import { LinkedInPostsService } from './services/linkedin-posts.service';
import { LinkedInSchedulerService } from './services/linkedin-scheduler.service';
import { LinkedInAgentService } from './services/linkedin-agent.service';
import { LinkedInToolExecutor } from './tools/linkedin-tool-executor';
import { LinkedInController } from './controllers/linkedin.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    EncryptionModule,
    forwardRef(() => AiModule),
  ],
  controllers: [LinkedInController],
  providers: [
    LinkedInAuthService,
    LinkedInApiService,
    GeminiImageService,
    LinkedInPostsService,
    LinkedInSchedulerService,
    LinkedInAgentService,
    LinkedInToolExecutor,
  ],
  exports: [LinkedInAuthService, LinkedInApiService, LinkedInPostsService, GeminiImageService],
})
export class LinkedInModule {}
