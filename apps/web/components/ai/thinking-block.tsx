"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  text: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ text, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="my-2 rounded-md border border-border/50 bg-muted/30 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        {isStreaming ? (
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
              <span className="h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
            </span>
            Pensando...
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
            Razonamiento
          </span>
        )}
        <svg
          className={cn("ml-auto h-3 w-3 transition-transform", expanded && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1">
          <p className="text-xs text-muted-foreground/80 italic leading-relaxed whitespace-pre-wrap font-mono">
            {text}
            {isStreaming && (
              <span className="inline-block w-1.5 h-3 bg-muted-foreground/50 animate-pulse ml-0.5 align-middle" />
            )}
          </p>
        </div>
      )}
    </div>
  );
}
