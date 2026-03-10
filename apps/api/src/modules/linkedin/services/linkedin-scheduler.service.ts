import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LinkedInPostsService } from './linkedin-posts.service';

@Injectable()
export class LinkedInSchedulerService {
  private readonly logger = new Logger(LinkedInSchedulerService.name);
  private isRunning = false;

  constructor(private readonly postsService: LinkedInPostsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const duePosts = await this.postsService.getScheduledDue();
      if (duePosts.length === 0) return;

      this.logger.log(`Publishing ${duePosts.length} scheduled LinkedIn post(s)`);

      for (const post of duePosts) {
        try {
          await this.postsService.publish(post.tenantId, post.id);
          this.logger.log(`Published LinkedIn post ${post.id} for tenant ${post.tenantId}`);
        } catch (err) {
          this.logger.error(`Failed to publish LinkedIn post ${post.id}:`, err);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
