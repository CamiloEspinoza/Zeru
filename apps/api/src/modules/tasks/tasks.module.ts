import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { FilesModule } from '../files/files.module';
import { TasksController } from './controllers/tasks.controller';
import { TaskCommentsController } from './controllers/task-comments.controller';
import { TaskActivityController } from './controllers/task-activity.controller';
import { TaskPropertiesController } from './controllers/task-properties.controller';
import { TasksService } from './services/tasks.service';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskActivityService } from './services/task-activity.service';
import { TaskPropertiesService } from './services/task-properties.service';
import { TaskNotificationListener } from './services/task-notification.listener';
import { TaskCronService } from './services/task-cron.service';
import { TaskDeltaSyncService } from './services/task-delta-sync.service';

@Module({
  imports: [NotificationModule, FilesModule],
  controllers: [
    TasksController,
    TaskCommentsController,
    TaskActivityController,
    TaskPropertiesController,
  ],
  providers: [
    TasksService,
    TaskCommentsService,
    TaskActivityService,
    TaskPropertiesService,
    TaskNotificationListener,
    TaskCronService,
    TaskDeltaSyncService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
