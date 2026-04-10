import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class TaskCronService {
  private readonly logger = new Logger(TaskCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Runs every day at 09:00 — finds tasks due today or tomorrow and notifies assignees */
  @Cron('0 9 * * *')
  async checkDueSoon() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const tasks = await this.prisma.task.findMany({
        where: {
          dueDate: { gte: today, lte: tomorrow },
          completedAt: null,
          deletedAt: null,
        },
        include: {
          assignees: { select: { userId: true } },
          project: { select: { id: true, name: true, tenantId: true } },
        },
      });

      this.logger.log(`Found ${tasks.length} tasks due soon`);

      for (const task of tasks) {
        for (const assignee of task.assignees) {
          this.eventEmitter.emit('task.due_soon', {
            tenantId: task.project.tenantId,
            projectId: task.projectId,
            taskId: task.id,
            taskTitle: task.title,
            userId: assignee.userId,
          });
        }
      }
    } catch (err) {
      this.logger.error('Failed to check due-soon tasks', err);
    }
  }
}
