"use client";

import { useCallback, useEffect, useState } from "react";
import { tasksApi } from "@/lib/api/tasks";
import { useProjectStore } from "@/stores/project-store";

export function useTaskActivity(taskId: string | null) {
  const setActivity = useProjectStore((s) => s.setActivity);
  const activity = useProjectStore((s) =>
    taskId ? s.activityByTask.get(taskId) ?? null : null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await tasksApi.getActivity(taskId, undefined, 50);
      setActivity(taskId, res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar actividad");
    } finally {
      setLoading(false);
    }
  }, [taskId, setActivity]);

  useEffect(() => {
    let cancelled = false;
    if (!taskId) return;
    setLoading(true);
    setError(null);
    tasksApi
      .getActivity(taskId, undefined, 50)
      .then((res) => {
        if (cancelled) return;
        setActivity(taskId, res.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar actividad");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, setActivity]);

  return { activity: activity ?? [], loading, error, refetch };
}
