"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Tab {
  label: string;
  code: string;
  language?: string;
}

interface CodeBlockProps {
  tabs?: Tab[];
  code?: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ tabs, code, language = "bash", filename }: CodeBlockProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);

  const current = tabs ? tabs[activeTab] : { label: filename ?? language, code: code ?? "", language };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#111] text-sm my-4">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-1 bg-[#0f0f0f]">
        <div className="flex">
          {tabs ? (
            tabs.map((tab, i) => (
              <button
                key={tab.label}
                onClick={() => setActiveTab(i)}
                className={cn(
                  "px-3 py-2 text-xs font-mono transition-colors",
                  i === activeTab
                    ? "text-white border-b border-white/60"
                    : "text-white/40 hover:text-white/70"
                )}
              >
                {tab.label}
              </button>
            ))
          ) : (
            <span className="px-3 py-2 text-xs font-mono text-white/40">
              {filename ?? language}
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-2 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {/* Code */}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-[#cdd6f4] font-mono">
        <code>{current.code}</code>
      </pre>
    </div>
  );
}
