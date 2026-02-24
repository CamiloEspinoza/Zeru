const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: "Contador IA",
    description:
      "Asistente conversacional que entiende el contexto de tu empresa, crea asientos contables, responde preguntas y razona en voz alta para que puedas seguir su lógica.",
    tag: "Activo",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: "Documentos inteligentes",
    description:
      "Sube facturas, estatutos, contratos o cualquier comprobante. La IA los lee, identifica las transacciones y propone los asientos contables correspondientes.",
    tag: "Activo",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    title: "Plan de cuentas chileno",
    description:
      "Estructura SII precargada con activos, pasivos, patrimonio, ingresos y gastos. Lista para usar, personalizable sin esfuerzo.",
    tag: "Activo",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    title: "Asientos con revisión",
    description:
      "Cada asiento propuesto por la IA pasa por tu revisión antes de contabilizarse. Ves el detalle completo y apruebas con un clic o solicitas correcciones.",
    tag: "Activo",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    title: "Multi-empresa",
    description:
      "Gestiona múltiples organizaciones desde una sola cuenta. Cada empresa tiene sus propios datos, usuarios y configuración de IA completamente aislados.",
    tag: "Activo",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: "Razonamiento visible",
    description:
      "Ves en tiempo real cómo piensa el agente: qué herramientas usa, qué datos consulta y por qué toma cada decisión. Transparencia total, sin caja negra.",
    tag: "Activo",
  },
];

export function FeaturesSection() {
  return (
    <section id="funcionalidades" className="py-28 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-4">
            Lo que Zeru hace hoy
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Contabilidad inteligente,{" "}
            <span className="text-white/40">desde el primer día</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            No necesitas saber de contabilidad para empezar. El asistente
            entiende tus documentos y hace el trabajo técnico por ti, siempre
            con tu aprobación.
          </p>
        </div>

        {/* Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
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
