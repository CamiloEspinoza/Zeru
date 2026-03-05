"use client";

interface ImageData {
  s3Key: string;
  imageUrl: string;
  mimeType: string;
}

export function ImagePreviewCard({
  image,
  onUseInPost,
}: {
  image: ImageData;
  onUseInPost?: (image: ImageData) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-purple-500 to-blue-500">
          <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <span className="text-xs font-medium text-foreground">Imagen generada con Gemini</span>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.imageUrl}
        alt="Generated image"
        className="w-full object-cover max-h-80"
      />

      {onUseInPost && (
        <div className="flex gap-2 px-4 py-3 border-t border-border/50">
          <button
            onClick={() => onUseInPost(image)}
            className="flex-1 rounded-lg bg-[#0A66C2] px-4 py-2 text-sm font-medium text-white hover:bg-[#004182] transition-colors"
          >
            Usar en post
          </button>
        </div>
      )}
    </div>
  );
}
