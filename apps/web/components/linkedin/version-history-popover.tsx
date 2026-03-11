"use client";

import { useState } from "react";

interface Version {
  id: string;
  content: string;
  versionNumber: number;
  instructions?: string | null;
  createdAt: string;
}

export function VersionHistoryPopover({
  versions,
  onSelect,
  isLoading,
}: {
  versions: Version[];
  onSelect: (versionId: string) => Promise<void>;
  isLoading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  if (versions.length === 0) return null;

  const handleSelect = async (versionId: string) => {
    setSelectingId(versionId);
    try {
      await onSelect(versionId);
      setOpen(false);
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={isLoading}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        title="Historial de versiones"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {versions.length} {versions.length === 1 ? "versión" : "versiones"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card shadow-lg overflow-hidden">
            <div className="px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-medium text-foreground">Versiones anteriores</span>
            </div>
            <div className="max-h-56 overflow-y-auto">
              {versions.map((v) => (
                <div
                  key={v.id}
                  className="flex items-start gap-2 px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-semibold text-muted-foreground">v{v.versionNumber}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(v.createdAt).toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                    <p className="text-[11px] text-foreground/80 line-clamp-2 leading-tight">{v.content}</p>
                    {v.instructions && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">
                        Instrucción: {v.instructions}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelect(v.id)}
                    disabled={selectingId === v.id}
                    className="shrink-0 rounded px-2 py-1 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {selectingId === v.id ? "…" : "Restaurar"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
