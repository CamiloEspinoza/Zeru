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
  onEditQuestion?: (index: number, text: string) => void;
  onDeleteQuestion?: (index: number) => void;
}

export function InterviewQuestionGroup({ theme, questions, onEditQuestion, onDeleteQuestion }: Props) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{theme}</h3>
      <div className="space-y-1.5">
        {questions.map((q, i) => (
          <InterviewQuestionCard
            key={i}
            question={q}
            index={i}
            onEdit={onEditQuestion ? (text) => onEditQuestion(i, text) : undefined}
            onDelete={onDeleteQuestion ? () => onDeleteQuestion(i) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
