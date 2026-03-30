const problems = [
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
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
    title: "Diagn\u00f3sticos que cuestan una fortuna y llegan tarde",
    description:
      "Un estudio organizacional cl\u00e1sico toma entre 4 y 12 semanas, cuesta entre $5.000 y $50.000 USD, y cuando llega, la empresa ya cambi\u00f3. Los cuellos de botella siguen ah\u00ed, pero ahora con un bonito informe en PDF.",
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
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
        />
      </svg>
    ),
    title: "Tu equipo sabe c\u00f3mo funciona la empresa. T\u00fa no.",
    description:
      "Cada persona en tu organizaci\u00f3n tiene un mapa mental de c\u00f3mo funcionan las cosas: qui\u00e9n depende de qui\u00e9n, d\u00f3nde se traban los procesos, qu\u00e9 funciona y qu\u00e9 no. Ese conocimiento vive en sus cabezas y se va cuando ellos se van.",
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
          d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
        />
      </svg>
    ),
    title: "Reorganizaciones basadas en organigramas, no en realidad",
    description:
      "El organigrama muestra la estructura formal. Pero las decisiones reales, las dependencias cr\u00edticas y los cuellos de botella viven en otra parte: en las conversaciones, en los procesos informales, en lo que la gente dice pero nadie documenta.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-28 px-6 relative">
      {/* Subtle divider gradient */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/20 bg-red-500/8 text-red-400 text-xs font-medium mb-6">
            El problema real
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Las empresas toman decisiones cr&iacute;ticas{" "}
            <span className="text-white/40">
              sin entender c&oacute;mo funcionan por dentro
            </span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Los consultores cobran miles de d&oacute;lares por un diagn&oacute;stico que toma
            semanas. Las encuestas de clima miden percepci&oacute;n, no realidad
            operativa. Y los gerentes generales toman decisiones basadas en
            intuici&oacute;n, no en datos.
          </p>
        </div>

        {/* Problem cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {problems.map((problem, i) => (
            <div
              key={problem.title}
              className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-8 hover:border-red-500/15 hover:bg-red-500/[0.02] transition-all duration-300 fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Icon */}
              <div className="mb-5 w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 group-hover:bg-red-500/15 transition-colors">
                {problem.icon}
              </div>
              {/* Content */}
              <h3 className="font-semibold text-white text-lg mb-3">
                {problem.title}
              </h3>
              <p className="text-sm text-white/45 leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>

        {/* Closing question */}
        <div className="text-center fade-in-up">
          <p className="text-xl sm:text-2xl font-display font-semibold text-white/70 max-w-3xl mx-auto leading-relaxed">
            &iquest;Y si pudieras convertir las conversaciones con tu equipo en un
            diagn&oacute;stico completo, autom&aacute;tico,{" "}
            <span className="text-teal-400">en d&iacute;as y no en meses?</span>
          </p>
        </div>
      </div>
    </section>
  );
}
