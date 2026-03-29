import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { ProjectsController } from './controllers/projects.controller';
import { InterviewsController } from './controllers/interviews.controller';
import { ProjectsService } from './services/projects.service';
import { InterviewsService } from './services/interviews.service';

@Module({
  imports: [FilesModule],
  controllers: [ProjectsController, InterviewsController],
  providers: [ProjectsService, InterviewsService],
  exports: [ProjectsService, InterviewsService],
})
export class OrgIntelligenceModule {}
