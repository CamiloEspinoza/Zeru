"use client";

import type { PendingFile, UploadedImage } from "@/hooks/use-chat-stream";

export type { PendingFile };

export interface PendingImage {
  localId: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  result?: UploadedImage;
  error?: string;
}

export function fileIcon(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime === "text/csv") return "CSV";
  if (mime.startsWith("text/")) return "TXT";
  if (mime === "application/json") return "JSON";
  if (
    mime === "application/vnd.ms-excel" ||
    mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mime === "application/vnd.oasis.opendocument.spreadsheet"
  )
    return "XLS";
  return "FILE";
}

export function FileChip({
  pf,
  onRemove,
}: {
  pf: PendingFile;
  onRemove?: () => void;
}) {
  const isImage = pf.file.type.startsWith("image/");

  const statusBadge =
    pf.status === "uploading" ? (
      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
        <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      </span>
    ) : pf.status === "error" ? (
      <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-destructive/60">
        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    ) : null;

  if (isImage && pf.previewUrl) {
    return (
      <div className="relative group flex-shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pf.previewUrl}
          alt={pf.file.name}
          className="h-16 w-16 rounded-lg object-cover border border-border"
        />
        {statusBadge}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative group flex-shrink-0 flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-xs">
      <span className="font-mono font-bold text-muted-foreground text-[10px]">
        {fileIcon(pf.file.type)}
      </span>
      <span className="max-w-[100px] truncate text-foreground">{pf.file.name}</span>
      {pf.status === "uploading" && (
        <svg className="h-3 w-3 animate-spin text-muted-foreground" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {pf.status === "error" && (
        <svg className="h-3 w-3 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      {pf.status === "done" && (
        <svg className="h-3 w-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="hidden group-hover:flex ml-1 text-muted-foreground hover:text-destructive"
        >
          ×
        </button>
      )}
    </div>
  );
}
