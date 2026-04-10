"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface PropertyTextEditorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function PropertyTextEditor({
  value,
  onChange,
  placeholder = "Vacío",
  maxLength = 5000,
  disabled = false,
}: PropertyTextEditorProps) {
  const [localValue, setLocalValue] = React.useState(value ?? "");

  React.useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const handleBlur = () => {
    const trimmed = localValue.trim();
    const newValue = trimmed === "" ? null : trimmed;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  return (
    <Input
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      disabled={disabled}
      className="h-7 text-xs"
    />
  );
}
