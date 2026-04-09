export type ProjectStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ARCHIVED";
export type ProjectVisibility = "PUBLIC" | "PRIVATE";
export type ProjectMemberRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
export type TaskPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type TaskViewType = "BOARD" | "LIST" | "CALENDAR" | "TIMELINE";
export type StatusCategory = "backlog" | "active" | "done" | "cancelled";

export interface UserSummary {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface TaskStatusConfig {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category: StatusCategory;
  sortOrder: number;
  isDefault: boolean;
}

export interface ProjectSection {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface ProjectMember {
  id: string;
  role: ProjectMemberRole;
  userId: string;
  user: UserSummary;
  createdAt: string;
}

export interface TaskView {
  id: string;
  name: string;
  type: TaskViewType;
  config: Record<string, unknown>;
  filters: Record<string, unknown>;
  isDefault: boolean;
  icon: string | null;
  sortOrder: number;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  key: string;
  icon: string | null;
  color: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate: string | null;
  dueDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  createdById: string;
  createdBy?: UserSummary;
  members?: ProjectMember[];
  taskStatuses?: TaskStatusConfig[];
  sections?: ProjectSection[];
  labels?: Label[];
  taskViews?: TaskView[];
  _count?: { tasks: number; members: number };
}

export interface Task {
  id: string;
  number: number;
  title: string;
  description: string | null;
  priority: TaskPriority;
  position: string;
  startDate: string | null;
  dueDate: string | null;
  completedAt: string | null;
  estimate: number | null;
  estimateUnit: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  statusId: string;
  sectionId: string | null;
  parentId: string | null;
  createdById: string;
  status?: TaskStatusConfig;
  section?: ProjectSection | null;
  assignees?: Array<{ userId: string; user: UserSummary }>;
  labels?: Array<{ labelId: string; label: Label }>;
  _count?: { subtasks: number; comments: number };
}

export interface TaskComment {
  id: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  updatedAt: string;
  taskId: string;
  authorId: string;
  author: UserSummary;
  parentId: string | null;
  reactions?: Array<{ emoji: string; userId: string }>;
  replies?: TaskComment[];
}

export interface TaskActivity {
  id: string;
  action: string;
  data: Record<string, unknown> | null;
  createdAt: string;
  taskId: string;
  actorId: string | null;
  actor?: UserSummary | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
