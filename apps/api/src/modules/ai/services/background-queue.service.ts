import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export interface BackgroundJob {
  name: string;
  fn: () => Promise<void>;
  maxRetries?: number;
  attempt?: number;
}

interface QueuedJob extends Required<Pick<BackgroundJob, 'name' | 'fn' | 'maxRetries'>> {
  attempt: number;
  scheduledAt: number;
}

const DEFAULT_MAX_RETRIES = 3;
const MAX_CONCURRENCY = 3;
const BASE_BACKOFF_MS = 1_000;

@Injectable()
export class BackgroundQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(BackgroundQueueService.name);
  private readonly queue: QueuedJob[] = [];
  private running = 0;
  private draining = false;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  enqueue(job: BackgroundJob): void {
    if (this.draining) return;

    this.queue.push({
      name: job.name,
      fn: job.fn,
      maxRetries: job.maxRetries ?? DEFAULT_MAX_RETRIES,
      attempt: job.attempt ?? 0,
      scheduledAt: Date.now(),
    });

    this.processNext();
  }

  private processNext(): void {
    while (this.running < MAX_CONCURRENCY && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.executeJob(job);
    }
  }

  private async executeJob(job: QueuedJob): Promise<void> {
    try {
      await job.fn();
      this.logger.debug(`[${job.name}] completed (attempt ${job.attempt + 1})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (job.attempt < job.maxRetries) {
        const delay = BASE_BACKOFF_MS * Math.pow(4, job.attempt);
        this.logger.warn(
          `[${job.name}] failed (attempt ${job.attempt + 1}/${job.maxRetries + 1}), retrying in ${delay}ms: ${message}`,
        );
        const timer = setTimeout(() => {
          this.timers.delete(timer);
          this.queue.push({ ...job, attempt: job.attempt + 1 });
          this.processNext();
        }, delay);
        this.timers.add(timer);
      } else {
        this.logger.error(
          `[${job.name}] failed permanently after ${job.attempt + 1} attempts: ${message}`,
        );
      }
    } finally {
      this.running--;
      this.processNext();
    }
  }

  get pendingCount(): number {
    return this.queue.length + this.running;
  }

  onModuleDestroy() {
    this.draining = true;
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
  }
}
