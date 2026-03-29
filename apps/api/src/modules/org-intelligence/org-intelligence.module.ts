import { Module, forwardRef } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';
import { DeepgramConfigService } from './services/deepgram-config.service';
import { TranscriptionService } from './services/transcription.service';
import { InterviewPipelineOrchestrator } from './services/interview-pipeline.orchestrator';

@Module({
  imports: [FilesModule, forwardRef(() => AiModule)],
  controllers: [ProjectsController, InterviewsController],
  providers: [ProjectsService, InterviewsService, DeepgramConfigService, TranscriptionService, InterviewPipelineOrchestrator],
  exports: [ProjectsService, InterviewsService, DeepgramConfigService, TranscriptionService, InterviewPipelineOrchestrator],
})
export class OrgIntelligenceModule {}
