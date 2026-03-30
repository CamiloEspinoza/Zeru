const differentiators = [
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    title: "Diagn\u00f3stico desde conversaciones, no desde formularios",
    description:
      "Las encuestas de clima miden percepci\u00f3n. Las entrevistas capturan realidad. Zeru es la \u00fanica plataforma que construye inteligencia organizacional a partir de lo que tu equipo realmente dice.",
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    ),
    title: "De audio a plan de mejoras en minutos",
    description:
      "Lo que un consultor tarda semanas en producir, Zeru lo genera autom\u00e1ticamente: transcripci\u00f3n, an\u00e1lisis, diagn\u00f3stico y plan priorizado con RICE. Por una fracci\u00f3n del costo.",
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
    title: "Knowledge Graph que conecta toda tu organizaci\u00f3n",
    description:
      "Cada entrevista alimenta un grafo de conocimiento con b\u00fasqueda sem\u00e1ntica. Mientras m\u00e1s entrevistas procesas, m\u00e1s rica y precisa se vuelve la imagen de tu organizaci\u00f3n.",
  },
  {
    icon: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "$0.65 por entrevista, no $5.000 por consultor\u00eda",
    description:
      "El costo de procesar una entrevista de 45 minutos con IA es de aproximadamente 65 centavos de d\u00f3lar. Un diagn\u00f3stico organizacional completo cuesta menos que un almuerzo de negocios.",
  },
];

export function DifferentiatorsSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: text */}
          <div className="fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
              Por qué Zeru
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mb-10">
              Lo que ninguna otra plataforma{" "}
              <span className="text-white/40">hace</span>
            </h2>

            <div className="space-y-8">
              {differentiators.map((diff, i) => (
                <div
                  key={diff.title}
                  className="flex gap-4 fade-in-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                    {diff.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-1.5">
                      {diff.title}
                    </h3>
                    <p className="text-sm text-white/45 leading-relaxed">
                      {diff.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: visual - Before/After comparison */}
          <div className="hidden lg:block fade-in-right">
            <div className="space-y-6">
              {/* Before card */}
              <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.03] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs font-medium text-red-400 uppercase tracking-widest">
                    Sin Zeru
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    "4-12 semanas de diagn\u00f3stico",
                    "$5.000 - $50.000 USD en consultor\u00eda",
                    "Resultados subjetivos en PDF",
                    "Sin datos estructurados",
                    "Se desactualiza inmediatamente",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-red-400/50 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      <span className="text-sm text-white/40">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* After card */}
              <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  <span className="text-xs font-medium text-teal-400 uppercase tracking-widest">
                    Con Zeru
                  </span>
                </div>
                <div className="space-y-3">
                  {[
                    "Diagn\u00f3stico en d\u00edas, no meses",
                    "~$0.65 USD por entrevista procesada",
                    "Knowledge Graph con b\u00fasqueda sem\u00e1ntica",
                    "Plan de mejoras priorizado (RICE)",
                    "Se enriquece con cada nueva entrevista",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-teal-400 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm text-white/60">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
