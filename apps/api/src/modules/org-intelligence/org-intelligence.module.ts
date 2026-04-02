import { Module, forwardRef } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { AiModule } from '../ai/ai.module';
import { UsersModule } from '../users/users.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { SearchController } from './controllers/search.controller';
import { EntitiesController } from './controllers/entities.controller';
import { DiagnosisController } from './controllers/diagnosis.controller';
import { ProblemsController } from './controllers/problems.controller';
import { ImprovementsController } from './controllers/improvements.controller';
import { PersonProfilesController } from './controllers/person-profiles.controller';
import { DepartmentsController } from './controllers/departments.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';
import { PersonProfilesService } from './services/person-profiles.service';
import { DepartmentsService } from './services/departments.service';
import { DeepgramConfigService } from './services/deepgram-config.service';
import { TranscriptionService } from './services/transcription.service';
import { ExtractionPipelineService } from './services/extraction-pipeline.service';
import { CoreferenceService } from './services/coreference.service';
import { ChunkingService } from './services/chunking.service';
import { OrgEmbeddingService } from './services/org-embedding.service';
import { OrgSearchService } from './services/org-search.service';
import { InterviewPipelineOrchestrator } from './services/interview-pipeline.orchestrator';
import { PipelineEventsService } from './services/pipeline-events.service';
import { OrgDiagramService } from './services/org-diagram.service';
import { OrgDiagnosisService } from './services/org-diagnosis.service';
import { OrgImprovementsService } from './services/org-improvements.service';
import { InterviewQuestionsService } from './services/interview-questions.service';

@Module({
  imports: [FilesModule, forwardRef(() => AiModule), UsersModule],
  controllers: [
    ProjectsController,
    InterviewsController,
    SearchController,
    EntitiesController,
    DiagnosisController,
    ProblemsController,
    ImprovementsController,
    PersonProfilesController,
    DepartmentsController,
  ],
  providers: [
    ProjectsService,
    InterviewsService,
    PersonProfilesService,
    DepartmentsService,
    DeepgramConfigService,
    TranscriptionService,
    ExtractionPipelineService,
    CoreferenceService,
    ChunkingService,
    OrgEmbeddingService,
    OrgSearchService,
    InterviewPipelineOrchestrator,
    PipelineEventsService,
    OrgDiagramService,
    OrgDiagnosisService,
    OrgImprovementsService,
    InterviewQuestionsService,
  ],
  exports: [
    ProjectsService,
    InterviewsService,
    PersonProfilesService,
    DepartmentsService,
    DeepgramConfigService,
    TranscriptionService,
    ExtractionPipelineService,
    CoreferenceService,
    ChunkingService,
    OrgEmbeddingService,
    OrgSearchService,
    InterviewPipelineOrchestrator,
    PipelineEventsService,
    OrgDiagramService,
    OrgDiagnosisService,
    OrgImprovementsService,
    InterviewQuestionsService,
  ],
})
export class OrgIntelligenceModule {}
