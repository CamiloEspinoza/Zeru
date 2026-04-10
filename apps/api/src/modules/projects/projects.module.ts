import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectMembersController } from './controllers/project-members.controller';
import { ProjectSectionsController } from './controllers/project-sections.controller';
import { ProjectStatusesController } from './controllers/project-statuses.controller';
import { ProjectLabelsController } from './controllers/project-labels.controller';
import { ProjectViewsController } from './controllers/project-views.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectMembersService } from './services/project-members.service';
import { ProjectStatusesService } from './services/project-statuses.service';
import { ProjectLabelsService } from './services/project-labels.service';
import { ProjectViewsService } from './services/project-views.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectMembersController,
    ProjectSectionsController,
    ProjectStatusesController,
    ProjectLabelsController,
    ProjectViewsController,
  ],
  providers: [
    ProjectsService,
    ProjectMembersService,
    ProjectStatusesService,
    ProjectLabelsService,
    ProjectViewsService,
  ],
  exports: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
