"use client";

import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "@/lib/api/projects";
import type { Project } from "@/types/projects";

export function useProject(projectId: string | null) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.getById(projectId);
      setProject(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar proyecto");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!projectId) {
      setProject(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    projectsApi
      .getById(projectId)
      .then((data) => {
        if (cancelled) return;
        setProject(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Error al cargar proyecto");
        setProject(null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return { project, loading, error, refetch };
}
