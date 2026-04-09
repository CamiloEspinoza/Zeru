"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useTaskActivity } from "@/hooks/use-task-activity";
import type { TaskActivity } from "@/types/projects";

interface TaskActivityFeedProps {
  taskId: string;
}

const ACTION_LABELS: Record<string, string> = {
  "task.created": "cre\u00f3 la tarea",
  "task.updated": "actualiz\u00f3 la tarea",
  "task.status_changed": "cambi\u00f3 el estado",
  "task.moved": "movi\u00f3 la tarea",
  "task.assigned": "asign\u00f3 la tarea",
  "task.comment.created": "coment\u00f3",
  "task.deleted": "elimin\u00f3 la tarea",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours}h`;
  const days = Math.floor(hours / 24);
  return `hace ${days}d`;
}

function actorName(activity: TaskActivity): string {
  if (!activity.actor) return "Sistema";
  return `${activity.actor.firstName} ${activity.actor.lastName}`.trim();
}

export function TaskActivityFeed({ taskId }: TaskActivityFeedProps) {
  const { activity, loading } = useTaskActivity(taskId);

  if (loading && activity.length === 0) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }

  if (activity.length === 0) {
    return <p className="text-xs text-muted-foreground">A\u00fan no hay actividad.</p>;
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Actividad</h3>
      <ul className="space-y-2">
        {activity.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-xs">
            <div className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0 flex-1">
              <p>
                <span className="font-medium">{actorName(item)}</span>{" "}
                <span className="text-muted-foreground">
                  {ACTION_LABELS[item.action] ?? item.action}
                </span>
              </p>
              <p className="text-muted-foreground">{timeAgo(item.createdAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
