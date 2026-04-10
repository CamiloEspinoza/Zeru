"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface PropertyUrlEditorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function PropertyUrlEditor({
  value,
  onChange,
  placeholder = "https://...",
  disabled = false,
}: PropertyUrlEditorProps) {
  const [localValue, setLocalValue] = React.useState(value ?? "");
  const [isEditing, setIsEditing] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === "") {
      setError(false);
      if (value !== null) onChange(null);
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError(true);
      return;
    }
    setError(false);
    if (trimmed !== value) {
      onChange(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  // Show link in read mode
  if (!isEditing && value && !disabled) {
    return (
      <div className="flex items-center gap-1.5 min-w-0">
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 hover:underline truncate"
          title={value}
        >
          {value}
        </a>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="text-muted-foreground hover:text-foreground text-xs shrink-0"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <Input
      type="url"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        setError(false);
      }}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={error}
      className={cn("h-7 text-xs", error && "border-destructive")}
    />
  );
}
