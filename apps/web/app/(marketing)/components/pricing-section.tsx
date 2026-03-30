import Link from "next/link";

const pricingItems = [
  {
    concept: "Plataforma Zeru",
    cost: "Gratis",
    highlight: true,
  },
  {
    concept: "Procesamiento de entrevista (~45 min)",
    cost: "~$0.65 USD",
    highlight: false,
  },
  {
    concept: "Chat con asistente IA (por sesi\u00f3n)",
    cost: "Variable seg\u00fan uso",
    highlight: false,
  },
  {
    concept: "Almacenamiento de archivos",
    cost: "Tu propio S3 (tu costo AWS)",
    highlight: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-14 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-teal-500/20 bg-teal-500/8 text-teal-400 text-xs font-medium mb-6">
            Transparencia total
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Sabes exactamente cuánto pagas{" "}
            <span className="text-white/60">antes de empezar</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Zeru es gratuito. Solo pagas el costo real de la IA que usas,
            directamente al proveedor. Sin markup, sin suscripciones ocultas, sin
            sorpresas.
          </p>
        </div>

        {/* Pricing table */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden fade-in-up">
          {/* Table header */}
          <div className="grid grid-cols-2 gap-4 px-6 py-4 border-b border-white/5 bg-white/[0.02]">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest">
              Concepto
            </span>
            <span className="text-xs font-semibold text-white/50 uppercase tracking-widest text-right">
              Costo
            </span>
          </div>
          {/* Table rows */}
          {pricingItems.map((item) => (
            <div
              key={item.concept}
              className={`grid grid-cols-2 gap-4 px-6 py-5 border-b border-white/5 last:border-0 ${
                item.highlight ? "bg-teal-500/[0.04]" : ""
              }`}
            >
              <span className="text-sm text-white/70">{item.concept}</span>
              <span
                className={`text-sm text-right font-medium ${
                  item.highlight ? "text-teal-400" : "text-white/60"
                }`}
              >
                {item.cost}
              </span>
            </div>
          ))}
        </div>

        {/* Footnote */}
        <p className="text-xs text-white/50 mt-4 text-center leading-relaxed">
          Los costos de IA dependen del proveedor (OpenAI) y varían según la
          longitud de las entrevistas y el uso del asistente. Usas tu propia API
          key — pagas directamente, sin intermediarios.
        </p>

        {/* CTA */}
        <div className="text-center mt-10 fade-in-up">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
          >
            Comenzar gratis — sin tarjeta de crédito
          </Link>
        </div>
      </div>
    </section>
  );
}
