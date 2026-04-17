import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import {
  LAB_IMPORT_QUEUE,
  ATTACHMENT_MIGRATION_QUEUE,
} from '../lab/constants/queue.constants';

export interface QueueStats {
  name: string;
  displayName: string;
  isPaused: boolean;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
}

export interface JobSummary {
  id: string;
  name: string;
  data: Record<string, unknown>;
  opts: Record<string, unknown>;
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  progress: number | string;
  attemptsMade: number;
  attemptsTotal: number;
  failedReason: string | null;
  stacktrace: string[];
  returnvalue: unknown;
}

const QUEUE_REGISTRY: { name: string; displayName: string }[] = [
  { name: LAB_IMPORT_QUEUE, displayName: 'Importación Lab' },
  { name: ATTACHMENT_MIGRATION_QUEUE, displayName: 'Descarga Adjuntos' },
];

const BROADCAST_INTERVAL_MS = 3000;

@Injectable()
export class QueueAdminService implements OnModuleDestroy, OnModuleInit {
  private readonly logger = new Logger(QueueAdminService.name);
  private queues: Map<string, Queue> = new Map();
  private registry = QUEUE_REGISTRY;
  private broadcastTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    const connection = {
      host: this.config.get<string>('REDIS_HOST', 'localhost'),
      port: this.config.get<number>('REDIS_PORT', 6380),
      maxRetriesPerRequest: null as null,
      lazyConnect: true,
    };

    for (const entry of this.registry) {
      this.queues.set(entry.name, new Queue(entry.name, { connection }));
    }
  }

  onModuleInit() {
    this.broadcastTimer = setInterval(() => this.broadcastStats(), BROADCAST_INTERVAL_MS);
  }

  async onModuleDestroy() {
    if (this.broadcastTimer) clearInterval(this.broadcastTimer);
    for (const q of this.queues.values()) {
      await q.close();
    }
  }

  private async broadcastStats() {
    try {
      const stats = await this.getAllStats();
      this.eventEmitter.emit('queues.stats', { queues: stats });
    } catch {
      // silent — next tick will retry
    }
  }

  async getAllStats(): Promise<QueueStats[]> {
    const results: QueueStats[] = [];

    for (const entry of this.registry) {
      const q = this.queues.get(entry.name)!;
      const [counts, isPaused] = await Promise.all([
        q.getJobCounts(
          'waiting',
          'active',
          'completed',
          'failed',
          'delayed',
          'paused',
        ),
        q.isPaused(),
      ]);

      results.push({
        name: entry.name,
        displayName: entry.displayName,
        isPaused,
        counts: {
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          completed: counts.completed ?? 0,
          failed: counts.failed ?? 0,
          delayed: counts.delayed ?? 0,
          paused: counts.paused ?? 0,
        },
      });
    }

    return results;
  }

  async getJobs(
    queueName: string,
    status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed',
    page: number,
    perPage: number,
  ): Promise<{ data: JobSummary[]; total: number }> {
    const q = this.getQueue(queueName);
    const start = (page - 1) * perPage;
    const end = start + perPage - 1;

    const [jobs, counts] = await Promise.all([
      q.getJobs([status], start, end),
      q.getJobCounts(status),
    ]);

    const total = (counts as Record<string, number>)[status] ?? 0;

    const data: JobSummary[] = jobs.map((j) => ({
      id: j.id ?? '',
      name: j.name,
      data: j.data,
      opts: {
        attempts: j.opts?.attempts,
        delay: j.opts?.delay,
        priority: j.opts?.priority,
      },
      timestamp: j.timestamp,
      processedOn: j.processedOn ?? null,
      finishedOn: j.finishedOn ?? null,
      progress:
        typeof j.progress === 'number' || typeof j.progress === 'string'
          ? j.progress
          : 0,
      attemptsMade: j.attemptsMade,
      attemptsTotal: j.opts?.attempts ?? 0,
      failedReason: j.failedReason ?? null,
      stacktrace: j.stacktrace ?? [],
      returnvalue: j.returnvalue,
    }));

    return { data, total };
  }

  async getJob(
    queueName: string,
    jobId: string,
  ): Promise<JobSummary | null> {
    const q = this.getQueue(queueName);
    const j = await q.getJob(jobId);
    if (!j) return null;

    return {
      id: j.id ?? '',
      name: j.name,
      data: j.data,
      opts: {
        attempts: j.opts?.attempts,
        delay: j.opts?.delay,
        priority: j.opts?.priority,
        backoff: j.opts?.backoff,
      },
      timestamp: j.timestamp,
      processedOn: j.processedOn ?? null,
      finishedOn: j.finishedOn ?? null,
      progress:
        typeof j.progress === 'number' || typeof j.progress === 'string'
          ? j.progress
          : 0,
      attemptsMade: j.attemptsMade,
      attemptsTotal: j.opts?.attempts ?? 0,
      failedReason: j.failedReason ?? null,
      stacktrace: j.stacktrace ?? [],
      returnvalue: j.returnvalue,
    };
  }

  async retryJob(queueName: string, jobId: string): Promise<void> {
    const q = this.getQueue(queueName);
    const job = await q.getJob(jobId);
    if (!job) return;
    await job.retry();
  }

  async retryAllFailed(queueName: string): Promise<number> {
    const q = this.getQueue(queueName);
    const failed = await q.getJobs(['failed']);
    let count = 0;
    for (const job of failed) {
      await job.retry();
      count++;
    }
    return count;
  }

  async cleanJobs(
    queueName: string,
    status: 'completed' | 'failed',
    gracePeriodMs = 0,
  ): Promise<number> {
    const q = this.getQueue(queueName);
    const removed = await q.clean(gracePeriodMs, 1000, status);
    return removed.length;
  }

  async pauseQueue(queueName: string): Promise<void> {
    const q = this.getQueue(queueName);
    await q.pause();
  }

  async resumeQueue(queueName: string): Promise<void> {
    const q = this.getQueue(queueName);
    await q.resume();
  }

  async removeJob(queueName: string, jobId: string): Promise<void> {
    const q = this.getQueue(queueName);
    const job = await q.getJob(jobId);
    if (job) await job.remove();
  }

  private getQueue(name: string): Queue {
    const q = this.queues.get(name);
    if (!q) throw new Error(`Queue "${name}" not found`);
    return q;
  }
}
