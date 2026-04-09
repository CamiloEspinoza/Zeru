"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskStatusConfig } from "@/types/projects";

interface TaskStatusBadgeProps {
  status: TaskStatusConfig;
}

export function TaskStatusBadge({ status }: TaskStatusBadgeProps) {
  const color = status.color ?? "#6B7280";
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: color,
        color: color,
        backgroundColor: `${color}15`,
      }}
      className="font-medium"
    >
      {status.name}
    </Badge>
  );
}
