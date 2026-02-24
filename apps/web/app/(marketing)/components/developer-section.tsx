
const projects = [
  {
    name: "Frest",
    url: "https://www.frest.cl",
    logo: "/frest_mercado_saludable_logo.jpeg",
    tagline: "Mercado saludable online",
    description:
      "E-commerce de frutas, verduras y +1.500 productos saludables con logística propia y 3 tiendas físicas en Santiago.",
    stat: "+350.000 pedidos",
    years: "2015 – hoy",
    tags: ["Retail tech", "Logística", "E-commerce"],
  },
  {
    name: "Ulern",
    url: "https://www.ulern.app",
    logo: "/ulernapp_logo.jpeg",
    tagline: "Educación adaptativa con IA",
    description:
      "Transforma cualquier material de estudio en sesiones estructuradas, gamificadas y adaptativas. Taxonomía de Bloom, repetición espaciada.",
    stat: "+20.000 estudiantes",
    years: "2024 – hoy",
    tags: ["EdTech", "LLM", "RAG"],
  },
  {
    name: "Ucap",
    url: "https://www.ucap.ai",
    logo: "/ucap.png",
    tagline: "Capacitación empresarial con IA",
    description:
      "Automatiza onboarding, refuerzo post-capacitación y medición de impacto en empresas. Basado en la metodología Ulern.",
    stat: "Beta abierta",
    years: "2025 – hoy",
    tags: ["HRTech", "IA", "Microlearning"],
  },
  {
    name: "Zeru",
    url: "#",
    logo: null,
    tagline: "Gestión empresarial con agentes de IA",
    description:
      "Plataforma de gestión open source construida sobre agentes de IA desde el día uno. Nace de 9 años operando contabilidad real en Frest.",
    stat: "Open source",
    years: "2025 – hoy",
    tags: ["Agentes IA", "Open Source", "SaaS"],
    isCurrentProject: true,
  },
];

const timeline = [
  {
    period: "2014 – 2022",
    role: "CTO",
    company: "Citolab",
    description:
      "Modernización tecnológica de laboratorio clínico con 40+ años. APIs de distribución de resultados, integración con clínicas y hospitales.",
  },
  {
    period: "2015 – hoy",
    role: "Cofounder",
    company: "Frest",
    description:
      "Retail-tech de alimentos frescos con operación activa: +1.500 productos, 3 tiendas físicas, +350k pedidos. Construyó desde cero el sistema de inventario, DTE y conciliación bancaria.",
    highlight: true,
  },
  {
    period: "2024 – hoy",
    role: "CEO & Cofounder",
    company: "Ulern",
    description:
      "Plataforma de aprendizaje con IA. Arquitectura LLM, RAG sobre corpus académicos ilimitados, gamificación adaptativa.",
  },
];

export function DeveloperSection() {
  return (
    <section id="creador" className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-24 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-2xl mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium mb-4">
            Sobre el creador
          </div>
          <h2 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Software construido por{" "}
            <span className="text-teal-400">alguien que vivió el problema</span>
          </h2>
        </div>

        {/* Bio + quote */}
        <div className="grid lg:grid-cols-5 gap-8 mb-16">
          {/* Avatar + bio */}
          <div className="lg:col-span-3 rounded-2xl border border-white/6 bg-white/[0.02] p-8 fade-in-up">
            <div className="flex items-start gap-5 mb-6">
              {/* Avatar */}
              <div className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden shadow-lg shadow-teal-500/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Camilo.jpg"
                  alt="Camilo Espinoza"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-display text-xl font-bold text-white">
                  Camilo Espinoza
                </h3>
                <p className="text-sm text-teal-400 font-medium">
                  Technical Founder · CEO @ Ulern
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  Santiago, Chile · Padre desde 2011
                </p>
              </div>
            </div>

            <p className="text-white/55 text-sm leading-relaxed mb-4">
              Technical founder construyendo sistemas nativos de IA. Más de 10
              años liderando tecnología en retail, salud y educación, operando
              empresas desde cero: desde la arquitectura de microservicios
              hasta la estrategia de producto.
            </p>
            <p className="text-white/55 text-sm leading-relaxed">
              Trabaja hands-on en arquitectura LLM, sistemas RAG, infraestructura
              distribuida (AWS, Docker) y optimización de costos de inferencia.
              Lleva 9 años gestionando contabilidad, inventario y documentos
              electrónicos en Frest —{" "}
              <span className="text-white/70">
                esa experiencia real es la base de Zeru.
              </span>
            </p>

            {/* Links */}
            <div className="mt-6 flex flex-wrap gap-2">
              <a
                href="https://www.linkedin.com/in/camilo-espinoza-c/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-white/60 hover:text-white text-xs transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                LinkedIn
              </a>
              {[
                { name: "Frest", url: "https://www.frest.cl" },
                { name: "Ulern", url: "https://www.ulern.app" },
                { name: "Ucap", url: "https://www.ucap.ai" },
              ].map((l) => (
                <a
                  key={l.name}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-white/60 hover:text-white text-xs transition-colors"
                >
                  {l.name}
                  <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* Quote + timeline */}
          <div className="lg:col-span-2 space-y-5">
            {/* Quote */}
            <div className="rounded-2xl border border-teal-500/20 bg-teal-500/5 p-6 fade-in-up" style={{ animationDelay: "100ms" }}>
              <div className="text-teal-500/40 text-5xl font-serif leading-none mb-2">"</div>
              <blockquote className="text-white/80 text-sm leading-relaxed font-medium italic">
                La tecnología que no cambia comportamientos solo automatiza el
                pasado.
              </blockquote>
              <p className="text-teal-400/60 text-xs mt-3">— Camilo Espinoza</p>
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-6 space-y-5 fade-in-up" style={{ animationDelay: "150ms" }}>
              <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest">
                Trayectoria
              </h4>
              {timeline.map((t, i) => (
                <div key={i} className="flex gap-3">
                  <div className="shrink-0 flex flex-col items-center">
                    <div className={`w-2 h-2 rounded-full mt-1 ${t.highlight ? "bg-teal-400" : "bg-white/20"}`} />
                    {i < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-white/8 mt-1.5" />
                    )}
                  </div>
                  <div className="pb-4 last:pb-0">
                    <div className="flex items-baseline gap-2 mb-0.5">
                      <span className={`text-xs font-semibold ${t.highlight ? "text-teal-400" : "text-white/60"}`}>
                        {t.role} @ {t.company}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/30 mb-1">{t.period}</p>
                    <p className="text-xs text-white/40 leading-relaxed">
                      {t.description}
                    </p>
                    {t.highlight && (
                      <p className="text-[10px] text-teal-400/70 mt-1 font-medium">
                        ↳ Base directa de Zeru
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {projects.map((p, i) => (
            <a
              key={p.name}
              href={p.isCurrentProject ? undefined : p.url}
              target={p.isCurrentProject ? undefined : "_blank"}
              rel={p.isCurrentProject ? undefined : "noopener noreferrer"}
              className={`group block rounded-2xl border p-5 transition-all duration-300 fade-in-up ${
                p.isCurrentProject
                  ? "border-teal-500/25 bg-teal-500/5 cursor-default"
                  : "border-white/6 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"
              }`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="mb-3 w-10 h-10 rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.logo}
                    alt={p.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xl">⚡</span>
                )}
              </div>
              <div className="flex items-start justify-between mb-1">
                <h3 className="font-display text-base font-bold text-white">
                  {p.name}
                </h3>
                {!p.isCurrentProject && (
                  <svg className="w-3.5 h-3.5 text-white/20 group-hover:text-white/40 transition-colors mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                )}
              </div>
              <p className="text-xs text-white/40 mb-2">{p.tagline}</p>
              <p className="text-xs text-white/35 leading-relaxed mb-4">
                {p.description}
              </p>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold ${p.isCurrentProject ? "text-teal-400" : "text-white/50"}`}>
                  {p.stat}
                </span>
                <span className="text-[10px] text-white/25">{p.years}</span>
              </div>
              <div className="flex flex-wrap gap-1 mt-3">
                {p.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/30 border border-white/6"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
