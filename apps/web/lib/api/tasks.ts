import { api } from "@/lib/api-client";
import type { Task, TaskComment, TaskActivity, PaginatedResponse } from "@/types/projects";
import type { TaskPropertyValue, SetPropertyValuePayload } from "@/types/custom-properties";

export interface CreateTaskPayload {
  title: string;
  description?: string;
  projectId: string;
  sectionId?: string;
  statusId?: string;
  assigneeIds?: string[];
  parentId?: string;
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  startDate?: string;
  dueDate?: string;
  estimate?: number;
  estimateUnit?: "POINTS" | "MINUTES" | "HOURS";
  labelIds?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string | null;
  statusId?: string;
  priority?: "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  sectionId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimate?: number | null;
  estimateUnit?: "POINTS" | "MINUTES" | "HOURS" | null;
}

export interface ListTasksQuery {
  projectId?: string;
  statusId?: string;
  priority?: string;
  assigneeId?: string;
  sectionId?: string;
  parentId?: string | null;
  labelIds?: string;
  search?: string;
  dueBefore?: string;
  dueAfter?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface MoveTaskPayload {
  sectionId?: string | null;
  position: string;
  statusId?: string;
}

function buildQuery(params: Record<string, unknown>): string {
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of entries) {
    usp.set(key, String(value));
  }
  return `?${usp.toString()}`;
}

export const tasksApi = {
  list: (query: ListTasksQuery = {}) =>
    api.get<PaginatedResponse<Task>>(
      `/tasks${buildQuery(query as Record<string, unknown>)}`,
    ),

  myTasks: (
    query: {
      status?: string;
      dueWithinDays?: number;
      page?: number;
      perPage?: number;
    } = {},
  ) =>
    api.get<PaginatedResponse<Task>>(
      `/tasks/my${buildQuery(query as Record<string, unknown>)}`,
    ),

  getById: (id: string) => api.get<Task>(`/tasks/${id}`),

  create: (payload: CreateTaskPayload) => api.post<Task>("/tasks", payload),

  update: (id: string, payload: UpdateTaskPayload) =>
    api.patch<Task>(`/tasks/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/tasks/${id}`),

  move: (id: string, payload: MoveTaskPayload) =>
    api.post<Task>(`/tasks/${id}/move`, payload),

  bulkUpdate: (taskIds: string[], update: UpdateTaskPayload) =>
    api.post<void>("/tasks/bulk-update", { taskIds, update }),

  addAssignee: (taskId: string, userId: string) =>
    api.post<void>(`/tasks/${taskId}/assignees`, { userId }),

  removeAssignee: (taskId: string, userId: string) =>
    api.delete<void>(`/tasks/${taskId}/assignees/${userId}`),

  addLabel: (taskId: string, labelId: string) =>
    api.post<void>(`/tasks/${taskId}/labels`, { labelId }),

  removeLabel: (taskId: string, labelId: string) =>
    api.delete<void>(`/tasks/${taskId}/labels/${labelId}`),

  addDependency: (taskId: string, dependsOnId: string, dependencyType: string = "BLOCKS") =>
    api.post<void>(`/tasks/${taskId}/dependencies`, { dependsOnId, dependencyType }),

  removeDependency: (taskId: string, depId: string) =>
    api.delete<void>(`/tasks/${taskId}/dependencies/${depId}`),

  // Comments
  listComments: (taskId: string) =>
    api.get<TaskComment[]>(`/tasks/${taskId}/comments`),

  createComment: (taskId: string, content: string, parentId?: string, mentionedUserIds?: string[]) =>
    api.post<TaskComment>(`/tasks/${taskId}/comments`, { content, parentId, mentionedUserIds }),

  uploadCommentFile: (taskId: string, file: File) =>
    api.uploadFile<{ url: string; s3Key: string; filename: string; size: number; mimeType: string }>(
      `/tasks/${taskId}/comments/upload`,
      file,
    ),

  updateComment: (taskId: string, commentId: string, content: string) =>
    api.patch<TaskComment>(`/tasks/${taskId}/comments/${commentId}`, { content }),

  deleteComment: (taskId: string, commentId: string) =>
    api.delete<void>(`/tasks/${taskId}/comments/${commentId}`),

  addReaction: (taskId: string, commentId: string, emoji: string) =>
    api.post<void>(`/tasks/${taskId}/comments/${commentId}/reactions`, { emoji }),

  removeReaction: (taskId: string, commentId: string, emoji: string) =>
    api.delete<void>(`/tasks/${taskId}/comments/${commentId}/reactions/${encodeURIComponent(emoji)}`),

  // Activity
  getActivity: (taskId: string, cursor?: string, limit: number = 30) =>
    api.get<{ data: TaskActivity[]; nextCursor: string | null }>(
      `/tasks/${taskId}/activity${buildQuery({ cursor, limit })}`,
    ),

  // Delta sync
  syncDelta: (projectId: string, versions: Record<string, number>) =>
    api.post<{ updated: Task[]; deleted: string[]; added: Task[] }>("/tasks/sync", {
      projectId,
      versions,
    }),

  // Custom property values
  getPropertyValues: (taskId: string) =>
    api.get<TaskPropertyValue[]>(`/tasks/${taskId}/properties`),

  setPropertyValue: (taskId: string, propertyId: string, data: SetPropertyValuePayload) =>
    api.patch<TaskPropertyValue>(`/tasks/${taskId}/properties/${propertyId}`, data),

  clearPropertyValue: (taskId: string, propertyId: string) =>
    api.delete<void>(`/tasks/${taskId}/properties/${propertyId}`),
};
