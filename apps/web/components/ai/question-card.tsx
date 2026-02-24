"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { QuestionPayload } from "@zeru/shared";

interface QuestionCardProps {
  toolCallId: string;
  payload: QuestionPayload;
  onAnswer: (toolCallId: string, answer: string) => void;
  answered?: boolean;
  answeredValue?: string;
}

export function QuestionCard({
  toolCallId,
  payload,
  onAnswer,
  answered = false,
  answeredValue,
}: QuestionCardProps) {
  const [freeText, setFreeText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const handleOptionClick = (optionLabel: string) => {
    if (answered) return;
    setSelected(optionLabel);
    onAnswer(toolCallId, optionLabel);
  };

  const handleFreeTextSubmit = () => {
    if (!freeText.trim() || answered) return;
    onAnswer(toolCallId, freeText.trim());
  };

  return (
    <div className="my-3 rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      {/* Question */}
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium leading-snug">{payload.question}</p>
      </div>

      {answered ? (
        <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
          <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm text-muted-foreground">
            Respondiste: <span className="font-medium text-foreground">{answeredValue}</span>
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Suggested options */}
          <div className="flex flex-wrap gap-2">
            {payload.options.map((opt) => (
              <Button
                key={opt.id}
                variant={selected === opt.label ? "default" : "outline"}
                size="sm"
                onClick={() => handleOptionClick(opt.label)}
                className="text-xs h-7"
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Free text input */}
          {payload.allowFreeText && (
            <div className="flex gap-2">
              <Textarea
                placeholder="O escribe tu respuesta..."
                value={freeText}
                onChange={(e) => setFreeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleFreeTextSubmit();
                  }
                }}
                className="min-h-0 resize-none text-sm py-2"
                rows={1}
              />
              <Button
                size="sm"
                onClick={handleFreeTextSubmit}
                disabled={!freeText.trim()}
                className="self-end"
              >
                Enviar
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
