import { Module } from '@nestjs/common';
import { ProjectsController } from './controllers/projects.controller';
import { ProjectMembersController } from './controllers/project-members.controller';
import { ProjectSectionsController } from './controllers/project-sections.controller';
import { ProjectStatusesController } from './controllers/project-statuses.controller';
import { ProjectLabelsController } from './controllers/project-labels.controller';
import { ProjectViewsController } from './controllers/project-views.controller';
import { ProjectPropertiesController } from './controllers/project-properties.controller';
import { ProjectsService } from './services/projects.service';
import { ProjectMembersService } from './services/project-members.service';
import { ProjectStatusesService } from './services/project-statuses.service';
import { ProjectLabelsService } from './services/project-labels.service';
import { ProjectViewsService } from './services/project-views.service';
import { ProjectPropertiesService } from './services/project-properties.service';

@Module({
  controllers: [
    ProjectsController,
    ProjectMembersController,
    ProjectSectionsController,
    ProjectStatusesController,
    ProjectLabelsController,
    ProjectViewsController,
    ProjectPropertiesController,
  ],
  providers: [
    ProjectsService,
    ProjectMembersService,
    ProjectStatusesService,
    ProjectLabelsService,
    ProjectViewsService,
    ProjectPropertiesService,
  ],
  exports: [ProjectsService, ProjectMembersService],
})
export class ProjectsModule {}
