import Link from "next/link";

export function CtaSection() {
  return (
    <section className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-teal-500/8 blur-[120px]" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center fade-in-up">
        <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
          Tu empresa tiene las respuestas.{" "}
          <span className="bg-gradient-to-r from-teal-400 to-teal-300 bg-clip-text text-transparent">
            Zeru las encuentra.
          </span>
        </h2>
        <p className="text-white/50 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
          Cada persona en tu equipo tiene una pieza del rompecabezas. Zeru las
          junta automáticamente y te muestra la imagen completa: dónde están los
          cuellos de botella, quién es irremplazable, qué procesos se pueden
          mejorar y por dónde empezar.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/register"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
          >
            Diagnostica tu empresa gratis
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
          Sin tarjeta de crédito. Configura en 5 minutos. Primera entrevista
          procesada en menos de 3 minutos.
        </p>
      </div>
    </section>
  );
}
