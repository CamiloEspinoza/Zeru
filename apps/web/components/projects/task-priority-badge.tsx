"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskPriority } from "@/types/projects";

interface TaskPriorityBadgeProps {
  priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string } | null> = {
  URGENT: { label: "Urgente", color: "#DC2626" },
  HIGH: { label: "Alta", color: "#EA580C" },
  MEDIUM: { label: "Media", color: "#CA8A04" },
  LOW: { label: "Baja", color: "#2563EB" },
  NONE: null,
};

export function TaskPriorityBadge({ priority }: TaskPriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];
  if (!config) return null;
  return (
    <Badge
      variant="outline"
      style={{
        borderColor: config.color,
        color: config.color,
        backgroundColor: `${config.color}15`,
      }}
      className="text-xs"
    >
      {config.label}
    </Badge>
  );
}
