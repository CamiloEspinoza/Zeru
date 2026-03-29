import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';
import { DeepgramConfigService } from './services/deepgram-config.service';

@Module({
  imports: [FilesModule],
  controllers: [ProjectsController, InterviewsController],
  providers: [ProjectsService, InterviewsService, DeepgramConfigService],
  exports: [ProjectsService, InterviewsService, DeepgramConfigService],
})
export class OrgIntelligenceModule {}
