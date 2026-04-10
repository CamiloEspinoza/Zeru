"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type ValidationStatus = "idle" | "validating" | "valid" | "invalid";

interface SecretFieldProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  validationStatus?: ValidationStatus;
  isSaving?: boolean;
  className?: string;
}

export function SecretField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  validationStatus = "idle",
  isSaving = false,
  className,
}: SecretFieldProps) {
  const [show, setShow] = useState(false);
  const busy = isSaving || validationStatus === "validating";

  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled ?? busy}
        className={cn(
          "pr-20 transition-colors",
          validationStatus === "valid" && "border-green-500 focus-visible:ring-green-500",
          validationStatus === "invalid" && "border-destructive focus-visible:ring-destructive",
          className,
        )}
        autoComplete="off"
        spellCheck={false}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
        {busy ? (
          <Spinner size="sm" />
        ) : validationStatus === "valid" ? (
          <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : validationStatus === "invalid" ? (
          <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="text-xs text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            {show ? "Ocultar" : "Mostrar"}
          </button>
        )}
      </div>
    </div>
  );
}
