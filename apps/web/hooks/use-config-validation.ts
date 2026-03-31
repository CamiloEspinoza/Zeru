"use client";

import { useCallback, useRef, useState } from "react";
import type { SaveStatus } from "@/components/config/save-indicator";

export type ValidationState = "idle" | "validating" | "valid" | "invalid";

interface UseConfigValidationOptions {
  validateFn?: (value: string) => Promise<boolean>;
  debounceMs?: number;
  flashMs?: number;
}

export function useConfigValidation({
  debounceMs = 800,
  flashMs = 2500,
}: UseConfigValidationOptions = {}) {
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [validationState, setValidationState] = useState<ValidationState>("idle");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const flashSaved = useCallback(
    (setter: (s: SaveStatus) => void = setSaveState, key = "default") => {
      setter("saved");
      if (timerRefs.current[key]) clearTimeout(timerRefs.current[key]);
      timerRefs.current[key] = setTimeout(() => setter("idle"), flashMs);
    },
    [flashMs],
  );

  const debouncedValidate = useCallback(
    (fn: () => void) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(fn, debounceMs);
    },
    [debounceMs],
  );

  return {
    saveState,
    setSaveState,
    flashSaved,
    validationState,
    setValidationState,
    debouncedValidate,
  };
}
