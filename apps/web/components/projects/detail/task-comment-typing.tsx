"use client";

import { useProjectStore } from "@/stores/project-store";

interface TaskCommentTypingProps {
  taskId: string;
}

export function TaskCommentTyping({ taskId }: TaskCommentTypingProps) {
  const typingMap = useProjectStore((s) => s.typingByTask.get(taskId));

  if (!typingMap || typingMap.size === 0) return null;

  const names = Array.from(typingMap.values()).map((u) => u.userName);
  const text =
    names.length === 1
      ? `${names[0]} est\u00e1 escribiendo...`
      : `${names.slice(0, -1).join(", ")} y ${names.at(-1)} est\u00e1n escribiendo...`;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <div className="flex gap-0.5">
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
        <span className="size-1 animate-bounce rounded-full bg-muted-foreground/60" />
      </div>
      <span>{text}</span>
    </div>
  );
}
