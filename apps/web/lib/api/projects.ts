import { api } from "@/lib/api-client";
import type {
  Project,
  ProjectMember,
  ProjectSection,
  TaskStatusConfig,
  Label,
  PaginatedResponse,
} from "@/types/projects";

export interface CreateProjectPayload {
  name: string;
  description?: string;
  key: string;
  visibility?: "PUBLIC" | "PRIVATE";
  color?: string;
  icon?: string;
  startDate?: string;
  dueDate?: string;
  memberIds?: string[];
}

export interface UpdateProjectPayload {
  name?: string;
  description?: string | null;
  status?: "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
  visibility?: "PUBLIC" | "PRIVATE";
  color?: string | null;
  icon?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface ListProjectsQuery {
  status?: string;
  search?: string;
  page?: number;
  perPage?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
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

export const projectsApi = {
  list: (query: ListProjectsQuery = {}) =>
    api.get<PaginatedResponse<Project>>(
      `/projects${buildQuery(query as Record<string, unknown>)}`,
    ),

  getById: (id: string) => api.get<Project>(`/projects/${id}`),

  create: (payload: CreateProjectPayload) =>
    api.post<Project>("/projects", payload),

  update: (id: string, payload: UpdateProjectPayload) =>
    api.patch<Project>(`/projects/${id}`, payload),

  remove: (id: string) => api.delete<void>(`/projects/${id}`),

  duplicate: (id: string) => api.post<Project>(`/projects/${id}/duplicate`, {}),

  // Members
  listMembers: (projectId: string) =>
    api.get<ProjectMember[]>(`/projects/${projectId}/members`),

  addMember: (projectId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") =>
    api.post<ProjectMember>(`/projects/${projectId}/members`, { userId, role }),

  updateMember: (projectId: string, userId: string, role: "ADMIN" | "MEMBER" | "VIEWER") =>
    api.patch<ProjectMember>(`/projects/${projectId}/members/${userId}`, { role }),

  removeMember: (projectId: string, userId: string) =>
    api.delete<void>(`/projects/${projectId}/members/${userId}`),

  // Sections
  listSections: (projectId: string) =>
    api.get<ProjectSection[]>(`/projects/${projectId}/sections`),

  createSection: (projectId: string, name: string) =>
    api.post<ProjectSection>(`/projects/${projectId}/sections`, { name }),

  updateSection: (projectId: string, sectionId: string, payload: { name?: string; sortOrder?: number }) =>
    api.patch<ProjectSection>(`/projects/${projectId}/sections/${sectionId}`, payload),

  deleteSection: (projectId: string, sectionId: string) =>
    api.delete<void>(`/projects/${projectId}/sections/${sectionId}`),

  reorderSections: (projectId: string, sectionIds: string[]) =>
    api.post<void>(`/projects/${projectId}/sections/reorder`, { sectionIds }),

  // Statuses
  listStatuses: (projectId: string) =>
    api.get<TaskStatusConfig[]>(`/projects/${projectId}/statuses`),

  createStatus: (projectId: string, payload: { name: string; slug: string; color?: string; category?: string }) =>
    api.post<TaskStatusConfig>(`/projects/${projectId}/statuses`, payload),

  updateStatus: (projectId: string, statusId: string, payload: { name?: string; color?: string | null; category?: string; sortOrder?: number }) =>
    api.patch<TaskStatusConfig>(`/projects/${projectId}/statuses/${statusId}`, payload),

  deleteStatus: (projectId: string, statusId: string) =>
    api.delete<void>(`/projects/${projectId}/statuses/${statusId}`),

  // Labels
  listLabels: (projectId: string) =>
    api.get<Label[]>(`/projects/${projectId}/labels`),

  createLabel: (projectId: string, name: string, color: string) =>
    api.post<Label>(`/projects/${projectId}/labels`, { name, color }),

  updateLabel: (projectId: string, labelId: string, payload: { name?: string; color?: string }) =>
    api.patch<Label>(`/projects/${projectId}/labels/${labelId}`, payload),

  deleteLabel: (projectId: string, labelId: string) =>
    api.delete<void>(`/projects/${projectId}/labels/${labelId}`),
};
