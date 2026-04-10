export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export type DomainEventType =
  | 'chat.message.sent'
  | 'chat.mention'
  | 'chat.reaction'
  | 'task.created'
  | 'task.assigned'
  | 'task.status_changed'
  | 'task.commented'
  | 'task.due_soon'
  | 'task.completed'
  | 'task.mentioned'
  | 'task.overdue'
  | 'lock.force_released'
  | 'project.member_added'
  | 'project.member_removed'
  | 'system.field_updated';
