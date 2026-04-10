"use client";

import { Checkbox } from "@/components/ui/checkbox";

interface PropertyCheckboxEditorProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function PropertyCheckboxEditor({
  value,
  onChange,
  disabled = false,
}: PropertyCheckboxEditorProps) {
  return (
    <Checkbox
      checked={value === true}
      onCheckedChange={(checked) => {
        onChange(checked === true);
      }}
      disabled={disabled}
    />
  );
}
