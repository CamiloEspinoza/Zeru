import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject } from 'rxjs';
import { ChatEvent } from '@zeru/shared';

@Injectable()
export class ActiveStreamsRegistry implements OnModuleDestroy {
  private readonly streams = new Map<string, Subject<ChatEvent>>();

  register(conversationId: string, subject: Subject<ChatEvent>): void {
    this.streams.set(conversationId, subject);
  }

  unregister(conversationId: string): void {
    this.streams.delete(conversationId);
  }

  get(conversationId: string): Subject<ChatEvent> | undefined {
    return this.streams.get(conversationId);
  }

  isActive(conversationId: string): boolean {
    return this.streams.has(conversationId);
  }

  onModuleDestroy(): void {
    this.streams.clear();
  }
}
