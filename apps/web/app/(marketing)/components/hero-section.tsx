import Link from "next/link";
import { HeroChat } from "./hero-chat";
import { HeroTypewriter } from "./hero-typewriter";

export function HeroSection() {
  return (
    <section className="relative min-h-[100dvh] flex items-start sm:items-center pt-20 sm:pt-16 overflow-hidden">
      {/* Background gradient mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-teal-500/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-teal-400/6 blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[2px] bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
        {/* Grid overlay */}
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
            Open source · Gratuito · Hecho en Chile
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <h1 className="font-display text-4xl lg:text-5xl font-bold leading-[1.15] tracking-tight text-white">
              <HeroTypewriter />
            </h1>
            <p className="text-lg text-white/50 font-normal leading-relaxed max-w-md">
              Zeru se diseñó desde el inicio con agentes de inteligencia
              artificial en el centro — no como un complemento, sino como la
              base. Contabiliza documentos, crea asientos y razona en
              conversación, como un contador de verdad.
            </p>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
            >
              Comenzar gratis
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
              href="#funcionalidades"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl font-medium text-sm transition-all hover:bg-white/5"
            >
              Ver funcionalidades
            </a>
          </div>

          {/* Social proof tags */}
          <div className="flex flex-wrap gap-4 pt-2">
            {[
              "Contabilidad chilena (SII)",
              "Multi-empresa",
              "IA con razonamiento visible",
              "Tus propias credenciales",
            ].map((tag) => (
              <span
                key={tag}
                className="flex items-center gap-1.5 text-xs text-white/40"
              >
                <svg
                  className="w-3.5 h-3.5 text-teal-500"
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

        {/* Right: animated chat mockup */}
        <div className="hidden lg:block relative fade-in-right">
          <HeroChat />
          {/* Floating glow */}
          <div className="absolute -inset-4 rounded-3xl bg-teal-500/5 blur-2xl -z-10" />
        </div>
      </div>

      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none" />
    </section>
  );
}
