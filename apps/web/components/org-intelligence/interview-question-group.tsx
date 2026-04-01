"use client";

import { InterviewQuestionCard } from "./interview-question-card";

interface Question {
  text: string;
  rationale?: string;
  priority: string;
}

interface Props {
  theme: string;
  questions: Question[];
  checkedSet?: Set<string>;
  onCheckedChange?: (questionKey: string, checked: boolean) => void;
  onEditQuestion?: (index: number, text: string) => void;
  onDeleteQuestion?: (index: number) => void;
  onDiscardQuestion?: (index: number) => void;
}

export function InterviewQuestionGroup({
  theme,
  questions,
  checkedSet,
  onCheckedChange,
  onEditQuestion,
  onDeleteQuestion,
  onDiscardQuestion,
}: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{theme}</h3>
      <div className="space-y-1.5">
        {questions.map((q, i) => {
          const key = `${theme}::${i}`;
          return (
            <InterviewQuestionCard
              key={i}
              question={q}
              index={i}
              checked={checkedSet?.has(key) ?? false}
              onCheckedChange={
                onCheckedChange
                  ? (checked) => onCheckedChange(key, checked)
                  : undefined
              }
              onEdit={
                onEditQuestion ? (text) => onEditQuestion(i, text) : undefined
              }
              onDelete={
                onDeleteQuestion ? () => onDeleteQuestion(i) : undefined
              }
              onDiscard={
                onDiscardQuestion ? () => onDiscardQuestion(i) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
