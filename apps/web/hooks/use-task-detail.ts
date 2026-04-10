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
    let cancelled = false;
    if (!taskId) {
      setTask(null);
      return;
    }
    setLoading(true);
    setError(null);
    tasksApi
      .getById(taskId)
      .then((data) => {
        if (cancelled) return;
        setTask(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar tarea");
        setTask(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  return { task, loading, error, refetch };
}
