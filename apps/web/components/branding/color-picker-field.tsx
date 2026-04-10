"use client";

import { Input } from "@/components/ui/input";

interface ColorPickerFieldProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorPickerField({
  label,
  hint,
  value,
  onChange,
}: ColorPickerFieldProps) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-8 rounded-md border-0 cursor-pointer p-0 bg-transparent"
        />
        <div className="flex-1">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="h-7 w-24 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
        </div>
      </div>
    </div>
  );
}
