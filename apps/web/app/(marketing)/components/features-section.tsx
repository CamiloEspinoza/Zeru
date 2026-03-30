const secondaryFeatures = [
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
    title: "Gesti\u00f3n de Personas",
    description:
      "Directorio con perfiles completos, organigrama interactivo con React Flow y departamentos jer\u00e1rquicos. La IA sugiere cambios en la estructura bas\u00e1ndose en lo que las entrevistas revelan.",
    tag: "Activo",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>
    ),
    title: "Asistente IA Conversacional",
    description:
      "Chat con GPT-5.4 que entiende el contexto de tu empresa. Sube PDFs, im\u00e1genes o Excel y la IA los procesa. Memoria contextual y skills extensibles para automatizar tareas repetitivas.",
    tag: "Activo",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
    title: "Contabilidad Chilena",
    description:
      "Plan de cuentas SII, libro diario, balance general y libro mayor. Per\u00edodos fiscales y estructura lista para operar desde el d\u00eda uno.",
    tag: "Activo",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
    title: "Marketing en LinkedIn",
    description:
      "Genera posts profesionales con IA, gestiona tu contenido y publica directamente desde Zeru. Ahorra horas de redacci\u00f3n manteniendo tu presencia activa.",
    tag: "Activo",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
    title: "Multi-empresa",
    description:
      "Gestiona m\u00faltiples organizaciones desde una sola cuenta. Cada empresa tiene datos, usuarios y configuraci\u00f3n completamente aislados.",
    tag: "Activo",
  },
  {
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
        />
      </svg>
    ),
    title: "Extensible con Skills",
    description:
      "Agrega nuevas capacidades al asistente IA con skills personalizados. API abierta para integrar con tus herramientas existentes.",
    tag: "Activo",
  },
];

export function FeaturesSection() {
  return (
    <section id="que-hace" className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
            Todo lo que necesitas
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Una plataforma completa{" "}
            <span className="text-white/40">
              para entender y gestionar tu organizaci&oacute;n
            </span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Zeru no es solo diagn&oacute;stico. Es una plataforma integral que conecta
            la inteligencia organizacional con la gesti&oacute;n diaria de tu empresa.
          </p>
        </div>

        {/* Primary feature - Org Intelligence highlighted */}
        <div className="mb-8 fade-in-up">
          <div className="group relative rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/[0.06] to-transparent p-8 md:p-10 hover:border-teal-500/30 transition-all duration-300">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <div className="inline-flex items-center gap-1.5 text-[10px] text-teal-400 font-semibold uppercase tracking-widest mb-4">
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                  M&oacute;dulo principal
                </div>
                <h3 className="font-display text-2xl sm:text-3xl font-bold text-white mb-4">
                  Inteligencia Organizacional
                </h3>
                <p className="text-white/50 leading-relaxed mb-6">
                  Transforma entrevistas en conocimiento accionable.
                  Transcripci&oacute;n autom&aacute;tica, extracci&oacute;n con IA, Knowledge Graph,
                  diagn&oacute;stico de cuellos de botella y plan de mejoras priorizado.
                </p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Transcripci\u00f3n",
                    "Knowledge Graph",
                    "Diagn\u00f3stico",
                    "Plan RICE",
                    "Diagramas AS-IS",
                  ].map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full text-xs bg-teal-500/10 border border-teal-500/20 text-teal-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              {/* Visual placeholder */}
              <div className="relative rounded-xl bg-[#111] border border-white/5 overflow-hidden">
                <div className="p-6 space-y-3">
                  {/* Mini dashboard mockup */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-4 w-40 rounded bg-white/10" />
                    <div className="h-6 w-20 rounded-md bg-teal-500/20 border border-teal-500/30" />
                  </div>
                  {/* Analysis results */}
                  {[
                    {
                      label: "Hechos clave extra\u00eddos",
                      value: "47",
                      color: "text-teal-400",
                    },
                    {
                      label: "Problemas detectados",
                      value: "12",
                      color: "text-amber-400",
                    },
                    {
                      label: "Dependencias mapeadas",
                      value: "23",
                      color: "text-blue-400",
                    },
                    {
                      label: "Mejoras propuestas",
                      value: "8",
                      color: "text-emerald-400",
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0"
                    >
                      <span className="text-xs text-white/40">
                        {item.label}
                      </span>
                      <span className={`text-sm font-semibold ${item.color}`}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                  {/* Progress bar */}
                  <div className="pt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-white/30">
                        An&aacute;lisis completado
                      </span>
                      <span className="text-[10px] text-teal-400">100%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-teal-500 to-teal-400" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow effect */}
            <div className="absolute -inset-1 rounded-2xl bg-teal-500/5 blur-xl -z-10 group-hover:bg-teal-500/10 transition-all duration-500" />
          </div>
        </div>

        {/* Secondary features grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {secondaryFeatures.map((f, i) => (
            <div
              key={f.title}
              className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-6 hover:border-teal-500/20 hover:bg-teal-500/[0.03] transition-all duration-300 fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Icon */}
              <div className="mb-4 w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/15 transition-colors">
                {f.icon}
              </div>
              {/* Content */}
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">
                {f.description}
              </p>
              {/* Tag */}
              <div className="mt-4 inline-flex items-center gap-1.5 text-[10px] text-teal-400/70 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                {f.tag}
              </div>
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
