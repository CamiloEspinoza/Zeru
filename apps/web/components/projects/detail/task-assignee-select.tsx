"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { projectsApi } from "@/lib/api/projects";
import { tasksApi } from "@/lib/api/tasks";
import type { ProjectMember, UserSummary } from "@/types/projects";

interface TaskAssigneeSelectProps {
  taskId: string;
  projectId: string;
  assignees: Array<{ userId: string; user: UserSummary }>;
  onUpdated?: () => void;
}

export function TaskAssigneeSelect({
  taskId,
  projectId,
  assignees,
  onUpdated,
}: TaskAssigneeSelectProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(false);

  const assigneeIds = new Set(assignees.map((a) => a.userId));

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await projectsApi.listMembers(projectId);
      setMembers(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (open && members.length === 0) {
      fetchMembers();
    }
  }, [open, members.length, fetchMembers]);

  async function handleToggle(userId: string) {
    try {
      if (assigneeIds.has(userId)) {
        await tasksApi.removeAssignee(taskId, userId);
      } else {
        await tasksApi.addAssignee(taskId, userId);
      }
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar asignados");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs font-medium justify-start"
        >
          {assignees.length === 0 ? (
            <span className="text-muted-foreground">Sin asignar</span>
          ) : (
            <div className="flex items-center gap-1">
              <div className="flex -space-x-1">
                {assignees.slice(0, 3).map((a) => (
                  <UserAvatar
                    key={a.userId}
                    userId={a.userId}
                    name={`${a.user.firstName} ${a.user.lastName}`}
                    className="size-5 border border-background"
                  />
                ))}
              </div>
              {assignees.length > 3 && (
                <span className="text-muted-foreground ml-1">+{assignees.length - 3}</span>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {loading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">Cargando...</p>
        ) : (
          <div className="space-y-0.5 max-h-60 overflow-y-auto">
            {members.map((m) => {
              const isAssigned = assigneeIds.has(m.userId);
              return (
                <button
                  key={m.userId}
                  onClick={() => handleToggle(m.userId)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                >
                  <UserAvatar
                    userId={m.userId}
                    name={`${m.user.firstName} ${m.user.lastName}`}
                    className="size-6"
                  />
                  <span className="truncate flex-1 text-left">
                    {m.user.firstName} {m.user.lastName}
                  </span>
                  {isAssigned && (
                    <span className="text-xs text-primary">&#10003;</span>
                  )}
                </button>
              );
            })}
            {members.length === 0 && (
              <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                No hay miembros
              </p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
