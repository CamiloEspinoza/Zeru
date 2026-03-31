"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface KnowledgeSummary {
  totalInterviews: number;
  departments: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
  processes: Array<{ id: string; name: string }>;
  systems: Array<{ id: string; name: string }>;
  problems: Array<{ id: string; title: string }>;
}

export function InterviewKnowledgeSummary({ projectId }: { projectId: string }) {
  const [summary, setSummary] = useState<KnowledgeSummary | null>(null);

  useEffect(() => {
    api
      .get<KnowledgeSummary>(`/org-intelligence/projects/${projectId}/knowledge-summary`)
      .then(setSummary)
      .catch(() => {});
  }, [projectId]);

  if (!summary) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Conocimiento del proyecto</CardTitle>
      </CardHeader>
      <CardContent>
        {summary.totalInterviews === 0 ? (
          <p className="text-sm text-muted-foreground">Primera entrevista del proyecto</p>
        ) : (
          <div className="flex flex-wrap gap-4 text-sm">
            <span><strong>{summary.departments.length}</strong> departamentos</span>
            <span><strong>{summary.roles.length}</strong> roles</span>
            <span><strong>{summary.processes.length}</strong> procesos</span>
            <span><strong>{summary.problems.length}</strong> problemas</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
