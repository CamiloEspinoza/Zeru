"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import { useProjectStore } from "@/stores/project-store";

export function useProjectTasks(projectId: string | null) {
  const setTasks = useProjectStore((s) => s.setTasks);
  const taskMap = useProjectStore((s) =>
    projectId ? s.tasksByProject.get(projectId) : undefined,
  );

  const tasks = useMemo(() => {
    if (!taskMap) return [];
    return Array.from(taskMap.values()).sort((a, b) =>
      a.position < b.position ? -1 : a.position > b.position ? 1 : 0,
    );
  }, [taskMap]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.list({ projectId, perPage: 500 });
      setTasks(projectId, res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tareas");
    } finally {
      setLoading(false);
    }
  }, [projectId, setTasks]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { tasks, loading, error, refetch };
}
