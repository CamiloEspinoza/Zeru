"use client";

import { useCallback, useEffect, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import type { Task } from "@/types/projects";

export function useTaskDetail(taskId: string | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await tasksApi.getById(taskId);
      setTask(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar tarea");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { task, loading, error, refetch };
}
