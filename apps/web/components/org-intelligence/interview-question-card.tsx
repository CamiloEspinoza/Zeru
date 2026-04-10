"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon } from "@hugeicons/core-free-icons";

interface Question { text: string; rationale?: string; priority: string }
interface Props {
  question: Question;
  index: number;
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onEdit?: (t: string) => void;
  onDiscard?: () => void;
}

const priorityLabels: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja",
};

const priorityStyles: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  LOW: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

export function InterviewQuestionCard({
  question,
  index,
  checked = false,
  onCheckedChange,
  onEdit,
  onDiscard,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);

  const handleBlur = () => {
    setEditing(false);
    if (text !== question.text) onEdit?.(text);
  };

  return (
    <div
      className={`flex items-start gap-2 rounded-md border p-2 text-sm transition-opacity ${
        checked ? "opacity-50" : ""
      }`}
    >
      {onCheckedChange && (
        <Checkbox
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5 shrink-0"
          aria-label={`Marcar pregunta ${index + 1} como realizada`}
        />
      )}
      <span className="shrink-0 font-medium text-muted-foreground">
        {index + 1}.
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            className="w-full resize-none rounded border px-1 text-sm focus:outline-none"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            autoFocus
          />
        ) : (
          <p
            className={`leading-snug ${onEdit ? "cursor-text" : ""} ${
              checked ? "line-through" : ""
            }`}
            onClick={() => onEdit && !checked && setEditing(true)}
          >
            {question.text}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <Badge
            className={`text-[10px] ${priorityStyles[question.priority] ?? priorityStyles.LOW}`}
          >
            {priorityLabels[question.priority] ?? question.priority}
          </Badge>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {onDiscard && !checked && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onDiscard}
            aria-label="Descartar pregunta"
          >
            <HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
