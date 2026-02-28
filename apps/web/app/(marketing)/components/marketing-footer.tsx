import Link from "next/link";

const currentYear = new Date().getFullYear();

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/5 bg-[#080808]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-10 mb-14">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500 text-white font-bold text-sm shadow-lg shadow-teal-500/20">
                Z
              </div>
              <span className="font-semibold text-white tracking-tight">
                Zeru
              </span>
            </div>
            <p className="text-sm text-white/40 leading-relaxed max-w-sm mb-5">
              Plataforma de gestión empresarial con agentes de IA. Gratuita, open
              source y hecho en Chile. Contabiliza, gestiona y crece — con un
              asistente que piensa contigo.
            </p>
            <div className="flex items-center gap-1.5 text-xs text-white/25">
              <span>Hecho con</span>
              <span className="text-red-400">♥</span>
              <span>en Chile por</span>
              <a
                href="https://www.linkedin.com/in/camilo-espinoza-c/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/40 hover:text-white/60 transition-colors underline underline-offset-2"
              >
                Camilo Espinoza
              </a>
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
              Producto
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Funcionalidades", href: "#funcionalidades" },
                { label: "Roadmap", href: "#roadmap" },
                { label: "Open Source", href: "#opensource" },
                { label: "Documentación", href: "/documents" },
              ].map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-white/40 hover:text-white/70 transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
              Acceso
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: "Iniciar sesión", href: "/login" },
                { label: "Crear cuenta", href: "/register" },
                { label: "GitHub", href: "https://github.com/camiloespinoza", external: true },
                { label: "LinkedIn", href: "https://www.linkedin.com/in/camilo-espinoza-c/", external: true },
              ].map((l) => (
                <li key={l.label}>
                  {"external" in l && l.external ? (
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white/40 hover:text-white/70 transition-colors inline-flex items-center gap-1"
                    >
                      {l.label}
                      <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      href={l.href}
                      className="text-sm text-white/40 hover:text-white/70 transition-colors"
                    >
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-white/20">
            © {currentYear} Zeru. Software libre — licencia MIT.
          </p>
          <div className="flex items-center gap-4">
            <span className="text-xs text-white/15">OpenAI · AWS S3 · NestJS · Next.js · Prisma</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
