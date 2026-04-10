import { create } from "zustand";
import type { Task, TaskComment, TaskActivity, UserSummary } from "@/types/projects";

export interface FieldLock {
  entityType: string;
  entityId: string;
  fieldName: string;
  user: UserSummary & { color?: string };
}

export interface TypingUser {
  userId: string;
  userName: string;
  startedAt: number;
}

interface ProjectState {
  // Tasks grouped by projectId
  tasksByProject: Map<string, Map<string, Task>>;
  // Currently open task (for detail sheet)
  openTaskId: string | null;
  // Comments by taskId
  commentsByTask: Map<string, TaskComment[]>;
  // Activity by taskId
  activityByTask: Map<string, TaskActivity[]>;
  // Typing indicators by taskId
  typingByTask: Map<string, Map<string, TypingUser>>;
  // Field locks keyed by `${entityType}:${entityId}:${fieldName}`
  locks: Map<string, FieldLock>;

  // Task actions
  setTasks: (projectId: string, tasks: Task[]) => void;
  upsertTask: (projectId: string, task: Task) => void;
  removeTask: (projectId: string, taskId: string) => void;
  patchTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  getTasks: (projectId: string) => Task[];
  getTask: (projectId: string, taskId: string) => Task | null;

  setOpenTaskId: (taskId: string | null) => void;

  // Comment actions
  setComments: (taskId: string, comments: TaskComment[]) => void;
  addComment: (taskId: string, comment: TaskComment) => void;
  updateComment: (taskId: string, commentId: string, patch: Partial<TaskComment>) => void;
  removeComment: (taskId: string, commentId: string) => void;
  addCommentReaction: (taskId: string, commentId: string, emoji: string, userId: string) => void;
  removeCommentReaction: (taskId: string, commentId: string, emoji: string, userId: string) => void;

  // Activity actions
  setActivity: (taskId: string, items: TaskActivity[]) => void;
  prependActivity: (taskId: string, item: TaskActivity) => void;

  // Typing actions
  setTypingUser: (taskId: string, user: TypingUser) => void;
  clearTypingUser: (taskId: string, userId: string) => void;

  // Lock actions
  setLock: (lock: FieldLock) => void;
  removeLock: (entityType: string, entityId: string, fieldName: string) => void;
  getLock: (entityType: string, entityId: string, fieldName: string) => FieldLock | null;
}

function lockKey(entityType: string, entityId: string, fieldName: string): string {
  return `${entityType}:${entityId}:${fieldName}`;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  tasksByProject: new Map(),
  openTaskId: null,
  commentsByTask: new Map(),
  activityByTask: new Map(),
  typingByTask: new Map(),
  locks: new Map(),

  setTasks: (projectId, tasks) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map<string, Task>();
      for (const task of tasks) taskMap.set(task.id, task);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  upsertTask: (projectId, task) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      taskMap.set(task.id, task);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  removeTask: (projectId, taskId) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      taskMap.delete(taskId);
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  patchTask: (projectId, taskId, patch) =>
    set((state) => {
      const next = new Map(state.tasksByProject);
      const taskMap = new Map(next.get(projectId) ?? []);
      const existing = taskMap.get(taskId);
      if (!existing) return state;
      taskMap.set(taskId, { ...existing, ...patch });
      next.set(projectId, taskMap);
      return { tasksByProject: next };
    }),

  getTasks: (projectId) => {
    const taskMap = get().tasksByProject.get(projectId);
    if (!taskMap) return [];
    return Array.from(taskMap.values()).sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  },

  getTask: (projectId, taskId) => {
    return get().tasksByProject.get(projectId)?.get(taskId) ?? null;
  },

  setOpenTaskId: (taskId) => set({ openTaskId: taskId }),

  setComments: (taskId, comments) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      next.set(taskId, comments);
      return { commentsByTask: next };
    }),

  addComment: (taskId, comment) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      if (existing.some((c) => c.id === comment.id)) return state;
      next.set(taskId, [...existing, comment]);
      return { commentsByTask: next };
    }),

  updateComment: (taskId, commentId, patch) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => (c.id === commentId ? { ...c, ...patch } : c)),
      );
      return { commentsByTask: next };
    }),

  removeComment: (taskId, commentId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.filter((c) => c.id !== commentId),
      );
      return { commentsByTask: next };
    }),

  addCommentReaction: (taskId, commentId, emoji, userId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = c.reactions ?? [];
          if (reactions.some((r) => r.emoji === emoji && r.userId === userId)) return c;
          return { ...c, reactions: [...reactions, { emoji, userId }] };
        }),
      );
      return { commentsByTask: next };
    }),

  removeCommentReaction: (taskId, commentId, emoji, userId) =>
    set((state) => {
      const next = new Map(state.commentsByTask);
      const existing = next.get(taskId) ?? [];
      next.set(
        taskId,
        existing.map((c) => {
          if (c.id !== commentId) return c;
          const reactions = (c.reactions ?? []).filter(
            (r) => !(r.emoji === emoji && r.userId === userId),
          );
          return { ...c, reactions };
        }),
      );
      return { commentsByTask: next };
    }),

  setActivity: (taskId, items) =>
    set((state) => {
      const next = new Map(state.activityByTask);
      next.set(taskId, items);
      return { activityByTask: next };
    }),

  prependActivity: (taskId, item) =>
    set((state) => {
      const next = new Map(state.activityByTask);
      const existing = next.get(taskId) ?? [];
      if (existing.some((a) => a.id === item.id)) return state;
      next.set(taskId, [item, ...existing]);
      return { activityByTask: next };
    }),

  setTypingUser: (taskId, user) =>
    set((state) => {
      const next = new Map(state.typingByTask);
      const existing = new Map(next.get(taskId) ?? []);
      existing.set(user.userId, user);
      next.set(taskId, existing);
      return { typingByTask: next };
    }),

  clearTypingUser: (taskId, userId) =>
    set((state) => {
      const next = new Map(state.typingByTask);
      const existing = new Map(next.get(taskId) ?? []);
      existing.delete(userId);
      next.set(taskId, existing);
      return { typingByTask: next };
    }),

  setLock: (lock) =>
    set((state) => {
      const next = new Map(state.locks);
      next.set(lockKey(lock.entityType, lock.entityId, lock.fieldName), lock);
      return { locks: next };
    }),

  removeLock: (entityType, entityId, fieldName) =>
    set((state) => {
      const next = new Map(state.locks);
      next.delete(lockKey(entityType, entityId, fieldName));
      return { locks: next };
    }),

  getLock: (entityType, entityId, fieldName) => {
    return get().locks.get(lockKey(entityType, entityId, fieldName)) ?? null;
  },
}));
