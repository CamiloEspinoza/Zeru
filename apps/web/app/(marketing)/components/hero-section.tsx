"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export function HeroSection() {
  const { user, loading } = useAuth();

  return (
    <section className="relative min-h-[100dvh] flex items-center pt-20 sm:pt-16 overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-400/6 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[2px] bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12 sm:py-24 grid lg:grid-cols-2 gap-16 items-center">
        {/* Left: copy */}
        <div className="space-y-8 fade-in-up">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            Inteligencia Organizacional con IA
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white">
              Entiende tu empresa{" "}
              <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
                en d&iacute;as,
              </span>{" "}
              no en meses
            </h1>
            <p className="text-lg text-white/50 font-normal leading-relaxed max-w-lg">
              Sube entrevistas con tu equipo y Zeru las transcribe, extrae el
              conocimiento clave y diagnostica cuellos de botella, dependencias
              cr&iacute;ticas y oportunidades de mejora. Todo autom&aacute;tico, todo con IA.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
              >
                Ir al Dashboard
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                  />
                </svg>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
                >
                  Diagnostica tu empresa gratis
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </Link>
                <a
                  href="#como-funciona"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl font-medium text-sm transition-all hover:bg-white/5"
                >
                  Ver c&oacute;mo funciona
                </a>
              </>
            )}
          </div>

          {/* Social proof tags */}
          <div className="flex flex-wrap gap-x-5 gap-y-3 pt-2">
            {[
              "~$0.65 USD por entrevista procesada",
              "Diagn\u00f3stico autom\u00e1tico en minutos",
              "5 an\u00e1lisis con GPT-5.4 por entrevista",
              "Knowledge Graph organizacional",
            ].map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 text-xs text-white/40"
              >
                <svg
                  className="w-3.5 h-3.5 text-teal-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Right: visual placeholder - Org Intelligence Dashboard mockup */}
        <div className="hidden lg:block relative fade-in-right">
          <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-1 shadow-2xl">
            <div className="rounded-xl bg-[#111] overflow-hidden">
              {/* Fake browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
                </div>
                <div className="flex-1 mx-8 h-5 rounded bg-white/5 flex items-center justify-center">
                  <span className="text-[10px] text-white/20">
                    zeruapp.com/org-intelligence
                  </span>
                </div>
              </div>
              {/* Dashboard content mockup */}
              <div className="p-6 space-y-4">
                {/* Top bar */}
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="h-4 w-48 rounded bg-white/10" />
                    <div className="h-3 w-32 rounded bg-white/5" />
                  </div>
                  <div className="h-8 w-24 rounded-lg bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <span className="text-[10px] text-teal-400 font-medium">
                      12 entrevistas
                    </span>
                  </div>
                </div>
                {/* Knowledge Graph visualization */}
                <div className="relative h-48 rounded-xl bg-gradient-to-br from-teal-500/5 to-transparent border border-white/5 flex items-center justify-center overflow-hidden">
                  {/* Graph nodes */}
                  <div className="absolute top-8 left-12 w-12 h-12 rounded-full bg-teal-500/20 border border-teal-500/30 flex items-center justify-center">
                    <span className="text-[8px] text-teal-300">CEO</span>
                  </div>
                  <div className="absolute top-6 right-16 w-10 h-10 rounded-full bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                    <span className="text-[8px] text-teal-300">CTO</span>
                  </div>
                  <div className="absolute bottom-8 left-24 w-11 h-11 rounded-full bg-teal-500/15 border border-teal-500/20 flex items-center justify-center">
                    <span className="text-[8px] text-teal-300">Ops</span>
                  </div>
                  <div className="absolute bottom-12 right-20 w-10 h-10 rounded-full bg-teal-500/10 border border-teal-500/15 flex items-center justify-center">
                    <span className="text-[8px] text-teal-300">RRHH</span>
                  </div>
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-teal-500/25 border-2 border-teal-500/40 flex items-center justify-center">
                    <span className="text-[9px] text-teal-200 font-medium">
                      KG
                    </span>
                  </div>
                  {/* Connecting lines */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 400 192"
                  >
                    <line
                      x1="72"
                      y1="56"
                      x2="200"
                      y2="96"
                      stroke="rgba(20,184,166,0.2)"
                      strokeWidth="1"
                    />
                    <line
                      x1="320"
                      y1="46"
                      x2="200"
                      y2="96"
                      stroke="rgba(20,184,166,0.2)"
                      strokeWidth="1"
                    />
                    <line
                      x1="120"
                      y1="148"
                      x2="200"
                      y2="96"
                      stroke="rgba(20,184,166,0.2)"
                      strokeWidth="1"
                    />
                    <line
                      x1="300"
                      y1="140"
                      x2="200"
                      y2="96"
                      stroke="rgba(20,184,166,0.2)"
                      strokeWidth="1"
                    />
                  </svg>
                  <div className="absolute bottom-2 right-3 text-[9px] text-white/20">
                    Knowledge Graph Organizacional
                  </div>
                </div>
                {/* Analysis results cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 space-y-1">
                    <div className="text-[10px] text-white/30">
                      Cuellos de botella
                    </div>
                    <div className="text-sm font-semibold text-amber-400">3</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 space-y-1">
                    <div className="text-[10px] text-white/30">SPOFs</div>
                    <div className="text-sm font-semibold text-red-400">2</div>
                  </div>
                  <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3 space-y-1">
                    <div className="text-[10px] text-white/30">Mejoras</div>
                    <div className="text-sm font-semibold text-teal-400">7</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* Floating glow */}
          <div className="absolute -inset-4 rounded-3xl bg-teal-500/5 blur-2xl -z-10" />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
    </section>
  );
}
