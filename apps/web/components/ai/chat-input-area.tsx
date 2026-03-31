"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileChip, type PendingFile, type PendingImage } from "@/components/ai/file-chip";

interface ChatInputAreaProps {
  input: string;
  pendingFiles: PendingFile[];
  pendingImages: PendingImage[];
  streaming: boolean;
  anyUploading: boolean;
  isDragging: boolean;
  acceptedTypes: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onAddFiles: (files: FileList) => void;
  onAddImage: (file: File) => void;
  onRemoveFile: (localId: string) => void;
  onRemoveImage: (localId: string) => void;
}

export function ChatInputArea({
  input,
  pendingFiles,
  pendingImages,
  streaming,
  anyUploading,
  isDragging,
  acceptedTypes,
  textareaRef,
  fileInputRef,
  imageInputRef,
  onInputChange,
  onKeyDown,
  onPaste,
  onSend,
  onAddFiles,
  onAddImage,
  onRemoveFile,
  onRemoveImage,
}: ChatInputAreaProps) {
  return (
    <div className="border-t px-3 md:px-6 pt-3 md:pt-4 pb-4 md:pb-5 shrink-0">
      <div
        className={cn(
          "rounded-xl border bg-background shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring",
          isDragging && "border-primary ring-1 ring-primary",
        )}
      >
        {(pendingFiles.length > 0 || pendingImages.length > 0) && (
          <div className="flex flex-wrap gap-2 px-4 pt-3 items-center">
            {pendingFiles.map((pf) => (
              <FileChip key={pf.localId} pf={pf} onRemove={() => onRemoveFile(pf.localId)} />
            ))}
            {pendingImages.map((pi) => (
              <div key={pi.localId} className="relative group flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pi.previewUrl}
                  alt={pi.file.name}
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
                {pi.status === "uploading" && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  </span>
                )}
                {pi.status === "error" && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-destructive/60">
                    <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => onRemoveImage(pi.localId)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar documento"
            className="flex-shrink-0 mb-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes}
            className="hidden"
            onChange={(e) => e.target.files && onAddFiles(e.target.files)}
          />

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            title="Adjuntar imagen para post"
            className="flex-shrink-0 mb-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              files.forEach((f) => onAddImage(f));
              e.target.value = "";
            }}
          />

          <textarea
            ref={textareaRef}
            autoFocus
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={
              pendingImages.length > 0
                ? "Describe qué quieres hacer con las imágenes…"
                : pendingFiles.length
                  ? "Agrega un mensaje o envía solo los archivos…"
                  : "Escribe un mensaje, arrastra archivos o pega imágenes…"
            }
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />

          {streaming ? (
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </Button>
          ) : (
            <Button
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={onSend}
              disabled={
                (!input.trim() && !pendingFiles.length && !pendingImages.some((p) => p.status === "done")) ||
                anyUploading ||
                pendingImages.some((p) => p.status === "uploading")
              }
              title={
                anyUploading || pendingImages.some((p) => p.status === "uploading")
                  ? "Esperando subida…"
                  : undefined
              }
            >
              {anyUploading || pendingImages.some((p) => p.status === "uploading") ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
            </Button>
          )}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        El asistente puede cometer errores. Verifica la información antes de confirmar acciones.
      </p>
    </div>
  );
}
