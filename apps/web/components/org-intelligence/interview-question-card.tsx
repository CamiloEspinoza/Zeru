"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Question { text: string; rationale?: string; priority: string }
interface Props { question: Question; index: number; onEdit?: (t: string) => void; onDelete?: () => void }

const priorityStyles: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
  MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300",
  LOW: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
};

export function InterviewQuestionCard({ question, index, onEdit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(question.text);

  const handleBlur = () => { setEditing(false); if (text !== question.text) onEdit?.(text); };

  return (
    <div className="flex items-start gap-2 rounded-md border p-2 text-sm">
      <span className="shrink-0 font-medium text-muted-foreground">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        {editing ? (
          <textarea className="w-full resize-none rounded border px-1 text-sm focus:outline-none" rows={2}
            value={text} onChange={(e) => setText(e.target.value)} onBlur={handleBlur} autoFocus />
        ) : (
          <p className="cursor-text leading-snug" onClick={() => onEdit && setEditing(true)}>{question.text}</p>
        )}
        <Badge className={`mt-1 text-[10px] ${priorityStyles[question.priority] ?? priorityStyles.LOW}`}>
          {question.priority}
        </Badge>
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete}
          className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Eliminar pregunta">
          x
        </button>
      )}
    </div>
  );
}
