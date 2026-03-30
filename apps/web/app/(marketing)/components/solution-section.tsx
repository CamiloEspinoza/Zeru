const pillars = [
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
    title: "Transcripci\u00f3n con IA de \u00faltima generaci\u00f3n",
    description:
      "Deepgram Nova-3 transcribe tus entrevistas con identificaci\u00f3n autom\u00e1tica de hablantes. Sube el audio y obt\u00e9n un texto limpio, segmentado y listo para an\u00e1lisis.",
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
    title: "5 pasadas de an\u00e1lisis con GPT-5.4",
    description:
      "Cada entrevista pasa por 5 an\u00e1lisis diferentes: extracci\u00f3n de hechos, identificaci\u00f3n de problemas, mapeo de dependencias, detecci\u00f3n de contradicciones y oportunidades de mejora.",
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
    title: "Knowledge Graph y diagn\u00f3stico autom\u00e1tico",
    description:
      "Toda la informaci\u00f3n se estructura en un grafo de conocimiento con b\u00fasqueda sem\u00e1ntica. Zeru detecta cuellos de botella, SPOFs (puntos \u00fanicos de falla) y genera diagramas de procesos AS-IS autom\u00e1ticamente.",
  },
];

export function SolutionSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
            La solución
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Zeru convierte entrevistas{" "}
            <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
              en inteligencia organizacional
            </span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Graba una conversación con alguien de tu equipo. Zeru hace el
            resto: transcribe, identifica hablantes, extrae conocimiento, detecta
            patrones y entrega un diagnóstico con plan de mejoras priorizado. Lo
            que antes tomaba semanas de consultoría, ahora toma minutos de
            procesamiento.
          </p>
        </div>

        {/* Three pillars */}
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map((pillar, i) => (
            <div
              key={pillar.title}
              className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-8 hover:border-teal-500/20 hover:bg-teal-500/[0.03] transition-all duration-300 fade-in-up"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {/* Icon */}
              <div className="mb-5 w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 group-hover:bg-teal-500/15 transition-colors">
                {pillar.icon}
              </div>
              {/* Content */}
              <h3 className="font-semibold text-white text-lg mb-3">
                {pillar.title}
              </h3>
              <p className="text-sm text-white/45 leading-relaxed">
                {pillar.description}
              </p>
              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-500/0 to-teal-500/0 group-hover:from-teal-500/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
