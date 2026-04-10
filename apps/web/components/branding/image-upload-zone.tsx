"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface ImageUploadZoneProps {
  label: string;
  hint: string;
  currentUrl: string | null;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  className?: string;
}

export function ImageUploadZone({
  label,
  hint,
  currentUrl,
  onUpload,
  onDelete,
  className,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className={className}>
      <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      {currentUrl ? (
        <div className="relative border rounded-lg p-4 flex flex-col items-center justify-center min-h-[140px] bg-muted/30">
          <img
            src={currentUrl}
            alt={label}
            className="max-h-20 max-w-full object-contain"
          />
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            onClick={async () => {
              setUploading(true);
              try {
                await onDelete();
              } finally {
                setUploading(false);
              }
            }}
            disabled={uploading}
          >
            {uploading ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[140px] cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {uploading ? (
            <p className="text-sm text-muted-foreground">Subiendo...</p>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-8 text-muted-foreground/40 mb-2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Zm16.5-13.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                />
              </svg>
              <p className="text-sm text-muted-foreground">
                Arrastra o haz clic para subir
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">{hint}</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
