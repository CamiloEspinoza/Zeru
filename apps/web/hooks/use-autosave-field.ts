"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useFieldLock } from "@/hooks/use-field-lock";

interface UseAutosaveFieldOptions<T> {
  entityType: string;
  entityId: string;
  fieldName: string;
  initialValue: T;
  save: (value: T) => Promise<void>;
  debounceMs?: number;
}

interface UseAutosaveFieldResult<T> {
  value: T;
  setValue: (value: T) => void;
  isDirty: boolean;
  isSaving: boolean;
  isLockedByOther: boolean;
  lockedByName: string | null;
  onFocus: () => void;
  onBlur: () => void;
}

export function useAutosaveField<T>({
  entityType,
  entityId,
  fieldName,
  initialValue,
  save,
  debounceMs = 800,
}: UseAutosaveFieldOptions<T>): UseAutosaveFieldResult<T> {
  const [value, setValueState] = useState<T>(initialValue);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<T>(initialValue);

  const { acquire, release, isLockedByOther, lockedByName } = useFieldLock({
    entityType,
    entityId,
    fieldName,
  });

  // Keep latest value in ref for timers
  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  // Sync external changes (from realtime) when not dirty
  useEffect(() => {
    if (!isDirty) {
      setValueState(initialValue);
      latestValueRef.current = initialValue;
    }
  }, [initialValue, isDirty]);

  const setValue = useCallback(
    (next: T) => {
      setValueState(next);
      setIsDirty(true);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await save(latestValueRef.current);
          setIsDirty(false);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Error al guardar");
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    },
    [save, debounceMs],
  );

  const onFocus = useCallback(() => {
    void acquire();
  }, [acquire]);

  const onBlur = useCallback(() => {
    // Flush pending save before releasing lock
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      if (isDirty) {
        setIsSaving(true);
        save(latestValueRef.current)
          .then(() => setIsDirty(false))
          .catch((err) =>
            toast.error(err instanceof Error ? err.message : "Error al guardar"),
          )
          .finally(() => {
            setIsSaving(false);
            void release();
          });
        return;
      }
    }
    void release();
  }, [save, release, isDirty]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return {
    value,
    setValue,
    isDirty,
    isSaving,
    isLockedByOther,
    lockedByName,
    onFocus,
    onBlur,
  };
}
