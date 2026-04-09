import { create } from "zustand";
import type { Task } from "@/types/projects";

interface ProjectState {
  // Tasks grouped by projectId
  tasksByProject: Map<string, Map<string, Task>>;
  // Currently open task (for detail sheet)
  openTaskId: string | null;

  setTasks: (projectId: string, tasks: Task[]) => void;
  upsertTask: (projectId: string, task: Task) => void;
  removeTask: (projectId: string, taskId: string) => void;
  patchTask: (projectId: string, taskId: string, patch: Partial<Task>) => void;
  getTasks: (projectId: string) => Task[];
  getTask: (projectId: string, taskId: string) => Task | null;

  setOpenTaskId: (taskId: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  tasksByProject: new Map(),
  openTaskId: null,

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
}));
