import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { TasksController } from './controllers/tasks.controller';
import { TaskCommentsController } from './controllers/task-comments.controller';
import { TaskActivityController } from './controllers/task-activity.controller';
import { TasksService } from './services/tasks.service';
import { TaskCommentsService } from './services/task-comments.service';
import { TaskActivityService } from './services/task-activity.service';
import { TaskNotificationListener } from './services/task-notification.listener';
import { TaskCronService } from './services/task-cron.service';
import { TaskDeltaSyncService } from './services/task-delta-sync.service';

@Module({
  imports: [NotificationModule],
  controllers: [TasksController, TaskCommentsController, TaskActivityController],
  providers: [
    TasksService,
    TaskCommentsService,
    TaskActivityService,
    TaskNotificationListener,
    TaskCronService,
    TaskDeltaSyncService,
  ],
  exports: [TasksService],
})
export class TasksModule {}
