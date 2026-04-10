"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PlusSignIcon,
  Delete02Icon,
} from "@hugeicons/core-free-icons";
import type { PropertyOption } from "@/types/custom-properties";

const DEFAULT_COLORS = [
  "#6B7280", "#EF4444", "#F97316", "#F59E0B", "#22C55E",
  "#14B8A6", "#3B82F6", "#6366F1", "#A855F7", "#EC4899",
];

interface PropertyOptionsEditorProps {
  options: PropertyOption[];
  onChange: (options: PropertyOption[]) => void;
}

export function PropertyOptionsEditor({
  options,
  onChange,
}: PropertyOptionsEditorProps) {
  const handleAddOption = () => {
    const colorIndex = options.length % DEFAULT_COLORS.length;
    onChange([
      ...options,
      {
        id: crypto.randomUUID(),
        label: "",
        color: DEFAULT_COLORS[colorIndex],
      },
    ]);
  };

  const handleUpdateLabel = (index: number, label: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], label };
    onChange(updated);
  };

  const handleUpdateColor = (index: number, color: string) => {
    const updated = [...options];
    updated[index] = { ...updated[index], color };
    onChange(updated);
  };

  const handleRemove = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">
        Opciones
      </label>
      <div className="space-y-1.5">
        {options.map((option, index) => (
          <div key={option.id} className="flex items-center gap-1.5">
            <input
              type="color"
              value={option.color}
              onChange={(e) => handleUpdateColor(index, e.target.value)}
              className="size-6 cursor-pointer rounded border-0 p-0"
              title="Color"
            />
            <Input
              value={option.label}
              onChange={(e) => handleUpdateLabel(index, e.target.value)}
              placeholder={`Opcion ${index + 1}`}
              className="h-7 flex-1 text-xs"
              maxLength={80}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => handleRemove(index)}
            >
              <HugeiconsIcon
                icon={Delete02Icon}
                strokeWidth={2}
                className="size-3.5 text-muted-foreground"
              />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={handleAddOption}
      >
        <HugeiconsIcon
          icon={PlusSignIcon}
          strokeWidth={2}
          className="size-3.5"
        />
        Agregar opcion
      </Button>
    </div>
  );
}
