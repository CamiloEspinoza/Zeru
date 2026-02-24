const pillars = [
  {
    emoji: "🆓",
    title: "Gratuito",
    description:
      "Zeru no tiene planes de pago ni funcionalidades bloqueadas. Todo el código es abierto. Si quieres apoyar el proyecto, aceptamos donaciones voluntarias.",
    detail: null,
  },
  {
    emoji: "🔑",
    title: "Tu API key, tus costos",
    description:
      "El costo de la inteligencia artificial lo pagas tú directamente al proveedor, sin intermediarios. Configuras tu propia API key y controlas tu gasto al 100%.",
    detail: "Actualmente soporta OpenAI (GPT-5.2). Próximamente: Claude, Gemini, Llama y más.",
  },
  {
    emoji: "☁️",
    title: "Tu propio S3",
    description:
      "Los documentos se almacenan en tu bucket de AWS S3. Zeru no guarda ni accede a tus archivos — los datos son completamente tuyos.",
    detail: "Incluye instrucciones paso a paso para configurar el bucket en minutos.",
  },
  {
    emoji: "🔍",
    title: "Sin intermediarios",
    description:
      "Sin markup, sin comisiones, sin sorpresas. Pagas directamente a OpenAI y a AWS. Zeru es solo el software que conecta todo.",
    detail: null,
  },
];

export function OpenSourceSection() {
  return (
    <section id="opensource" className="py-28 px-6 relative">
      {/* Divider line */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium mb-4">
            Modelo de costos transparente
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Abierto, transparente,{" "}
            <span className="text-teal-400">sin letra chica</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Creemos que las pymes no deberían pagar fortunas por software de
            gestión. Zeru es gratuito y sus costos operativos recaen directamente
            en quien los genera.
          </p>
        </div>

        {/* Pillars grid */}
        <div className="grid sm:grid-cols-2 gap-5 mb-16">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className="rounded-2xl border border-white/6 bg-white/[0.02] p-7 fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="text-3xl mb-4">{p.emoji}</div>
              <h3 className="font-display text-xl font-bold text-white mb-2">
                {p.title}
              </h3>
              <p className="text-white/50 text-sm leading-relaxed mb-3">
                {p.description}
              </p>
              {p.detail && (
                <p className="text-xs text-teal-400/70 border-t border-teal-500/10 pt-3">
                  {p.detail}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* AI Providers */}
        <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-8 mb-8 fade-in-up">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1">
              <h3 className="font-display text-xl font-bold text-white mb-2">
                Proveedores de IA soportados
              </h3>
              <p className="text-white/50 text-sm leading-relaxed">
                Actualmente Zeru utiliza la{" "}
                <span className="text-white/70">Responses API de OpenAI</span>{" "}
                con modelos de razonamiento avanzado. Se integrarán nuevos
                proveedores a medida que el proyecto crece.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 shrink-0">
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-teal-500/20 bg-teal-500/8">
                <span className="text-sm font-semibold text-white">OpenAI</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-500/20 text-teal-400 font-medium">Activo</span>
              </div>
              {["Claude", "Gemini", "Llama"].map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/6 bg-white/[0.02]"
                >
                  <span className="text-sm text-white/40">{p}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 font-medium">Próximo</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Donation CTA */}
        <div className="relative rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/8 to-teal-500/3 p-8 text-center overflow-hidden fade-in-up">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-teal-500/8 blur-3xl" />
          </div>
          <div className="relative">
            <div className="text-3xl mb-3">❤️</div>
            <h3 className="font-display text-2xl font-bold text-white mb-2">
              Apoya el proyecto
            </h3>
            <p className="text-white/50 text-sm leading-relaxed max-w-lg mx-auto mb-6">
              Zeru es gratuito y siempre lo será. Si te sirve y quieres
              contribuir a que el desarrollo continúe, las donaciones son
              bienvenidas. También puedes contribuir con código.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href="https://github.com/camiloespinoza"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium text-sm transition-all border border-white/10"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                Ver en GitHub
              </a>
              <a
                href="https://www.linkedin.com/in/camilo-espinoza-c/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-teal-500/20"
              >
                Contactar al creador
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
