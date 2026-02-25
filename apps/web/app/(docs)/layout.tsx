import type { Metadata } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { DocsNav } from "./docs/components/docs-nav";
import Link from "next/link";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Zeru API Docs",
  description: "Documentación de la API pública de Zeru para integrar aplicaciones externas con tu contabilidad.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bricolage.variable} ${jetbrainsMono.variable} min-h-screen bg-[#0a0a0a] text-[#ededed]`}>
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-sm">
            <span className="text-white">Zeru</span>
            <span className="text-white/30">/</span>
            <span className="text-white/60">API Reference</span>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-xs text-white/40 font-mono bg-white/5 px-2 py-1 rounded border border-white/10">
              v1
            </span>
            <Link
              href="/dashboard"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              Ir al dashboard →
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-white/10 px-4 py-6">
          <DocsNav />
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-8 py-10 max-w-4xl">
          {children}
        </main>
      </div>
    </div>
  );
}
