"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

interface ConfigDeleteActionProps {
  title: string;
  description: string;
  onConfirm: () => Promise<void>;
  buttonLabel?: string;
}

export function ConfigDeleteAction({
  title,
  description,
  onConfirm,
  buttonLabel = "Eliminar",
}: ConfigDeleteActionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {loading ? (
          <Spinner size="sm" />
        ) : (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )}
        {buttonLabel}
      </Button>
      <ConfirmDeleteDialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        onConfirm={handleConfirm}
        loading={loading}
      />
    </>
  );
}
