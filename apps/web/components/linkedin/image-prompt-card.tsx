"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api-client";

interface ImageVersion {
  id: string;
  prompt: string;
  imageUrl: string;
  versionNumber: number;
  isSelected: boolean;
}

export function ImagePromptCard({
  postId,
  initialPrompt,
  currentImageUrl,
  imageVersions: initialVersions,
  onImageUpdated,
}: {
  postId: string;
  initialPrompt?: string | null;
  currentImageUrl?: string | null;
  imageVersions?: ImageVersion[];
  onImageUpdated?: (imageUrl: string, s3Key: string) => void;
}) {
  const [prompt, setPrompt] = useState(initialPrompt ?? "");
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState(currentImageUrl ?? "");
  const [versions, setVersions] = useState<ImageVersion[]>(initialVersions ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    try {
      const result = await api.post<{ imageVersion: ImageVersion; imageUrl: string; s3Key: string }>(
        `/linkedin/posts/${postId}/generate-image`,
        { prompt: prompt.trim(), model: "flash" },
      );
      setImageUrl(result.imageUrl);
      setVersions((prev) => [
        { ...result.imageVersion, isSelected: true },
        ...prev.map((v) => ({ ...v, isSelected: false })),
      ]);
      onImageUpdated?.(result.imageUrl, result.s3Key);
    } catch {
      // silently fail
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectVersion = async (versionId: string) => {
    try {
      await api.put(`/linkedin/posts/${postId}/select-image-version`, { versionId });
      const selected = versions.find((v) => v.id === versionId);
      if (selected) {
        setImageUrl(selected.imageUrl);
        setVersions((prev) => prev.map((v) => ({ ...v, isSelected: v.id === versionId })));
        onImageUpdated?.(selected.imageUrl, "");
      }
    } catch {
      // silently fail
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/linkedin/posts/${postId}/upload-image`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Upload failed");
      const result = await response.json();
      setImageUrl(result.mediaUrl);
      onImageUpdated?.(result.mediaUrl, result.imageS3Key);
    } catch {
      // silently fail
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Current image */}
      {imageUrl && (
        <div className="relative rounded-lg overflow-hidden bg-muted/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Post image"
            className="w-full object-contain max-h-[300px]"
          />
        </div>
      )}

      {/* Image version thumbnails */}
      {versions.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => handleSelectVersion(v.id)}
              className={`shrink-0 rounded-md overflow-hidden border-2 transition-colors ${
                v.isSelected ? "border-primary" : "border-transparent hover:border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.imageUrl}
                alt={`Versión ${v.versionNumber}`}
                className="h-12 w-12 object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Prompt editor */}
      <div className="rounded-lg border border-border bg-muted/20 p-2.5 space-y-2">
        <div className="flex items-center gap-1.5 mb-1">
          <svg className="h-3.5 w-3.5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
          </svg>
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Prompt de imagen</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe la imagen que quieres generar..."
          rows={2}
          className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-ring resize-none"
        />
        <div className="flex gap-2">
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-purple-500 to-blue-500 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Generando…
              </>
            ) : imageUrl ? (
              "Regenerar imagen"
            ) : (
              "Generar imagen"
            )}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {isUploading ? (
              <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            Subir
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}
