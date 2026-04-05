import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingFooter } from "./marketing-footer";

interface FeatureItem {
  icon: ReactNode;
  title: string;
  description: string;
}

interface Step {
  number: number;
  title: string;
  description: string;
}

interface FeaturePageLayoutProps {
  badge?: string;
  badgeColor?: "teal" | "gray";
  title: string;
  subtitle: string;
  features: FeatureItem[];
  steps?: Step[];
  isUpcoming?: boolean;
}

const badgeStyles = {
  teal: "border-teal-500/20 bg-teal-500/8 text-teal-400",
  gray: "border-white/10 bg-white/5 text-white/50",
};

export function FeaturePageLayout({
  badge,
  badgeColor = "teal",
  title,
  subtitle,
  features,
  steps,
  isUpcoming = false,
}: FeaturePageLayoutProps) {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-teal-500/5 blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          {badge && (
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-6 ${badgeStyles[badgeColor]}`}
            >
              {badgeColor === "teal" && (
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              )}
              {badge}
            </div>
          )}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
            {title}
          </h1>
          <p className="text-white/50 text-lg sm:text-xl leading-relaxed max-w-3xl mx-auto">
            {subtitle}
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="max-w-6xl mx-auto">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-6 hover:border-teal-500/20 hover:bg-teal-500/[0.03] transition-all duration-300"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="mb-4 w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/15 transition-colors">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {f.description}
                </p>
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps (How it works) */}
      {steps && steps.length > 0 && (
        <section className="py-20 px-6 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
                {steps.length} pasos simples
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
                Como funciona
              </h2>
            </div>

            <div className="relative max-w-3xl mx-auto">
              <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/30 via-teal-500/15 to-transparent" />

              <div className="space-y-10">
                {steps.map((step) => (
                  <div key={step.number} className="relative pl-16 md:pl-20">
                    <div className="absolute left-0 md:left-2 top-0 w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center z-10">
                      <span className="text-teal-400 font-bold text-sm">
                        {String(step.number).padStart(2, "0")}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-6 md:p-8 hover:border-teal-500/15 hover:bg-teal-500/[0.02] transition-all duration-300">
                      <h3 className="font-semibold text-white text-lg mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-white/60 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* CTA or Email Capture */}
      <section className="py-20 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-teal-500/5 blur-[100px]" />
        </div>

        <div className="relative max-w-2xl mx-auto text-center">
          {isUpcoming ? (
            <>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
                Se parte de los primeros
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Dejanos tu email y te avisamos cuando este modulo este disponible.
                Los primeros en registrarse tendran acceso anticipado.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="tu@email.com"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/50 text-sm focus:outline-none focus:border-teal-500/40 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                />
                <button
                  type="button"
                  className="px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30 whitespace-nowrap"
                >
                  Avisame
                </button>
              </div>
              <p className="text-xs text-white/50 mt-4">
                Sin spam. Solo un aviso cuando este listo.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
                Empieza a usar{" "}
                <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
                  Zeru hoy
                </span>
              </h2>
              <p className="text-white/50 text-lg leading-relaxed mb-8">
                Crea tu cuenta gratis y comienza a transformar la gestion de tu
                empresa con inteligencia artificial.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
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
              </div>
              <p className="text-xs text-white/50 mt-6">
                Sin tarjeta de crédito. Configura en 5 minutos.
              </p>
            </>
          )}
        </div>
      </section>

      <MarketingFooter />
    </>
  );
}
