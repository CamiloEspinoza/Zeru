import { Module, forwardRef } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { SearchController } from './controllers/search.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';
import { DeepgramConfigService } from './services/deepgram-config.service';
import { TranscriptionService } from './services/transcription.service';
import { ExtractionPipelineService } from './services/extraction-pipeline.service';
import { CoreferenceService } from './services/coreference.service';
import { ChunkingService } from './services/chunking.service';
import { OrgEmbeddingService } from './services/org-embedding.service';
import { OrgSearchService } from './services/org-search.service';
import { InterviewPipelineOrchestrator } from './services/interview-pipeline.orchestrator';

@Module({
  imports: [FilesModule, forwardRef(() => AiModule)],
  controllers: [ProjectsController, InterviewsController, SearchController],
  providers: [
    ProjectsService,
    InterviewsService,
    DeepgramConfigService,
    TranscriptionService,
    ExtractionPipelineService,
    CoreferenceService,
    ChunkingService,
    OrgEmbeddingService,
    OrgSearchService,
    InterviewPipelineOrchestrator,
  ],
  exports: [
    ProjectsService,
    InterviewsService,
    DeepgramConfigService,
    TranscriptionService,
    ExtractionPipelineService,
    CoreferenceService,
    ChunkingService,
    OrgEmbeddingService,
    OrgSearchService,
    InterviewPipelineOrchestrator,
  ],
})
export class OrgIntelligenceModule {}
