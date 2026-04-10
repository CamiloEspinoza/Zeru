"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

interface PropertyNumberEditorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function PropertyNumberEditor({
  value,
  onChange,
  placeholder = "Vacío",
  disabled = false,
}: PropertyNumberEditorProps) {
  const [localValue, setLocalValue] = React.useState(
    value !== null ? String(value) : "",
  );

  React.useEffect(() => {
    setLocalValue(value !== null ? String(value) : "");
  }, [value]);

  const handleBlur = () => {
    if (localValue.trim() === "") {
      if (value !== null) onChange(null);
      return;
    }
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed) && parsed !== value) {
      onChange(parsed);
    } else if (isNaN(parsed)) {
      // Reset to previous value
      setLocalValue(value !== null ? String(value) : "");
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
      inputMode="decimal"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      className="h-7 text-xs"
    />
  );
}
