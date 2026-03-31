"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface SpeakerItem {
  speakerLabel: string;
  name: string;
  role?: string;
  department?: string;
  isInterviewer: boolean;
  personEntityId?: string;
}

interface SpeakerListProps {
  speakers: SpeakerItem[];
  onRemove: (index: number) => void;
  onToggleInterviewer: (index: number) => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function SpeakerList({
  speakers,
  onRemove,
  onToggleInterviewer,
}: SpeakerListProps) {
  if (speakers.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {speakers.map((speaker, index) => (
        <div
          key={index}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {getInitials(speaker.name)}
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-medium">{speaker.name}</span>
            {(speaker.role || speaker.department) && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                {[speaker.role, speaker.department].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onToggleInterviewer(index)}
            className="shrink-0"
          >
            <Badge
              variant={speaker.isInterviewer ? "default" : "outline"}
              className="cursor-pointer text-[10px]"
            >
              Entrevistador
            </Badge>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
          >
            <span className="text-base leading-none">&times;</span>
            <span className="sr-only">Eliminar</span>
          </Button>
        </div>
      ))}
    </div>
  );
}
