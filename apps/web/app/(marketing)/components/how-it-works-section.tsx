const steps = [
  {
    number: "01",
    title: "Entrevista a tu equipo",
    description:
      "Graba una conversaci\u00f3n de 30-60 minutos con cualquier persona de tu organizaci\u00f3n. Puede ser presencial, por Zoom o por tel\u00e9fono. Cualquier formato de audio funciona.",
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
  },
  {
    number: "02",
    title: "Sube el audio a Zeru",
    description:
      "Arrastra el archivo a la plataforma. En menos de 3 minutos, Zeru transcribe la entrevista completa con identificaci\u00f3n autom\u00e1tica de qui\u00e9n habla.",
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
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
    ),
  },
  {
    number: "03",
    title: "La IA extrae el conocimiento",
    description:
      "GPT-5.4 analiza la transcripci\u00f3n en 5 pasadas independientes: hechos clave, problemas detectados, dependencias entre \u00e1reas, contradicciones con otras entrevistas y oportunidades de mejora.",
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
  },
  {
    number: "04",
    title: "Recibe tu diagn\u00f3stico",
    description:
      "Zeru construye un Knowledge Graph organizacional, genera diagramas de procesos AS-IS en formato Mermaid y entrega un plan de mejoras priorizado con RICE (Reach, Impact, Confidence, Effort). Todo listo para tomar decisiones.",
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
          d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-20 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
            4 pasos simples
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight">
            De una entrevista a un{" "}
            <span className="text-white/40">diagnóstico completo</span>
          </h2>
        </div>

        {/* Steps - vertical timeline */}
        <div className="relative max-w-3xl mx-auto">
          {/* Vertical line */}
          <div className="absolute left-6 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/30 via-teal-500/15 to-transparent" />

          <div className="space-y-12">
            {steps.map((step, i) => (
              <div
                key={step.number}
                className="relative pl-16 md:pl-20 fade-in-up"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                {/* Step number circle */}
                <div className="absolute left-0 md:left-2 top-0 w-12 h-12 md:w-12 md:h-12 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center z-10">
                  <span className="text-teal-400 font-bold text-sm">
                    {step.number}
                  </span>
                </div>

                <div className="group rounded-2xl border border-white/6 bg-white/[0.02] p-6 md:p-8 hover:border-teal-500/15 hover:bg-teal-500/[0.02] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="hidden sm:flex shrink-0 w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 items-center justify-center text-teal-400">
                      {step.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-white text-lg mb-2">
                        {step.title}
                      </h3>
                      <p className="text-sm text-white/45 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Callout box */}
        <div className="max-w-3xl mx-auto mt-16 fade-in-up">
          <div className="rounded-2xl border border-teal-500/20 bg-teal-500/[0.05] p-6 md:p-8 text-center">
            <p className="text-white/70 text-base leading-relaxed">
              <span className="text-teal-400 font-semibold">
                Costo promedio por entrevista procesada: ~$0.65 USD.
              </span>{" "}
              Un diagnóstico completo de una empresa de 50 personas con 12
              entrevistas cuesta menos de $8 USD en procesamiento IA.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
