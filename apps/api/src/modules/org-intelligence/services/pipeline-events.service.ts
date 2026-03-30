import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { PipelineEvent } from '@zeru/shared';

/**
 * In-memory registry of active SSE subjects for interview pipeline events.
 * Each interview being processed gets a Subject that emits PipelineEvent items.
 * Connected clients subscribe; when the pipeline completes or fails the subject
 * is completed and removed.
 */
@Injectable()
export class PipelineEventsService implements OnModuleDestroy {
  private readonly streams = new Map<string, Subject<PipelineEvent>>();

  /** Get or create a Subject for the given interview. */
  getOrCreate(interviewId: string): Subject<PipelineEvent> {
    let subject = this.streams.get(interviewId);
    if (!subject || subject.closed) {
      subject = new Subject<PipelineEvent>();
      this.streams.set(interviewId, subject);
    }
    return subject;
  }

  /** Get an existing Subject (returns undefined when pipeline is not active). */
  get(interviewId: string): Subject<PipelineEvent> | undefined {
    const subject = this.streams.get(interviewId);
    if (subject?.closed) {
      this.streams.delete(interviewId);
      return undefined;
    }
    return subject;
  }

  /** Emit an event to all subscribers of a given interview. */
  emit(interviewId: string, event: PipelineEvent): void {
    const subject = this.streams.get(interviewId);
    if (subject && !subject.closed) {
      subject.next(event);
    }
  }

  /** Complete (close) the stream for a given interview. */
  complete(interviewId: string): void {
    const subject = this.streams.get(interviewId);
    if (subject && !subject.closed) {
      subject.complete();
    }
    this.streams.delete(interviewId);
  }

  /** Check whether a stream is currently active. */
  isActive(interviewId: string): boolean {
    const subject = this.streams.get(interviewId);
    return !!subject && !subject.closed;
  }

  onModuleDestroy(): void {
    for (const [, subject] of this.streams) {
      if (!subject.closed) subject.complete();
    }
    this.streams.clear();
  }
}
