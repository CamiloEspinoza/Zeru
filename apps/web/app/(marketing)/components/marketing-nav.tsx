"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain01Icon,
  HierarchyIcon,
  ChatBotIcon,
  Calculator01Icon,
  Megaphone01Icon,
  Calendar01Icon,
  DocumentValidationIcon,
  PuzzleIcon,
  DashboardBrowsingIcon,
  ApiIcon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";

const platformItems = [
  {
    name: "Inteligencia Organizacional",
    description: "Diagnostica tu empresa con IA a partir de entrevistas",
    href: "/features/inteligencia-organizacional",
    icon: AiBrain01Icon,
  },
  {
    name: "Personas y Organigrama",
    description: "Directorio de personas y estructura organizacional interactiva",
    href: "/features/personas-organigrama",
    icon: HierarchyIcon,
  },
  {
    name: "Asistente IA",
    description: "Chat inteligente con memoria y capacidades extensibles",
    href: "/features/asistente-ia",
    icon: ChatBotIcon,
  },
  {
    name: "Contabilidad",
    description: "Plan de cuentas, libro diario, balance y reportes fiscales",
    href: "/features/contabilidad",
    icon: Calculator01Icon,
  },
  {
    name: "Marketing",
    description: "Genera y publica contenido en LinkedIn con IA",
    href: "/features/marketing",
    icon: Megaphone01Icon,
  },
];

const upcomingItems = [
  {
    name: "Gestion de RRHH",
    description: "Contratos, vacaciones, asistencia y evaluaciones",
    href: "/features/gestion-rrhh",
    icon: Calendar01Icon,
  },
  {
    name: "Gestion Documental",
    description: "Flujos de aprobacion, firma electronica y versionado",
    href: "/features/gestion-documental",
    icon: DocumentValidationIcon,
  },
  {
    name: "Integraciones",
    description: "SAP, Google Workspace, Microsoft 365 y mas",
    href: "/features/integraciones",
    icon: PuzzleIcon,
  },
  {
    name: "Reportes y BI",
    description: "Dashboards customizables y KPIs en tiempo real",
    href: "/features/reportes-bi",
    icon: DashboardBrowsingIcon,
  },
  {
    name: "API Publica",
    description: "Endpoints, webhooks y SDK para desarrolladores",
    href: "/features/api-publica",
    icon: ApiIcon,
  },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [productoOpen, setProductoOpen] = useState(false);
  const { user, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close mobile menu on route change / resize
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
        setProductoOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0a0a0a]/90 backdrop-blur-md border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="font-semibold text-white tracking-tight hover:text-white/90 transition-colors"
        >
          Zeru
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1">
          {/* Producto mega menu */}
          <li className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-white/60 hover:text-white rounded-md hover:bg-white/5 transition-colors"
            >
              Producto
              <HugeiconsIcon
                icon={ArrowDown01Icon}
                className="size-3.5 transition-transform duration-200 group-hover:rotate-180"
              />
            </button>

            {/* Mega menu dropdown */}
            <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 absolute -left-64 top-full pt-3 transition-all duration-200 ease-out">
              <div className="w-[700px] rounded-xl border border-white/10 bg-[#0f0f0f]/98 backdrop-blur-xl p-6 shadow-2xl shadow-black/40">
                <div className="grid grid-cols-2 gap-8">
                  {/* Columna Plataforma */}
                  <div>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      Plataforma
                    </p>
                    <div className="space-y-0.5">
                      {platformItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors group/item"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 group-hover/item:bg-teal-500/15 transition-colors">
                            <HugeiconsIcon icon={item.icon} size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white/80 group-hover/item:text-white transition-colors">
                              {item.name}
                            </p>
                            <p className="text-xs text-white/35 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Columna Proximamente */}
                  <div>
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
                      Proximamente
                    </p>
                    <div className="space-y-0.5">
                      {upcomingItems.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex gap-3 rounded-lg p-2.5 hover:bg-white/5 transition-colors group/item opacity-60 hover:opacity-80"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/40 group-hover/item:bg-white/8 transition-colors">
                            <HugeiconsIcon icon={item.icon} size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-white/60 group-hover/item:text-white/80 transition-colors">
                                {item.name}
                              </p>
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-white/5 border border-white/10 text-white/35">
                                Pronto
                              </span>
                            </div>
                            <p className="text-xs text-white/25 leading-relaxed">
                              {item.description}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </li>

          <li>
            <Link
              href="/#pricing"
              className="px-3 py-1.5 text-sm text-white/60 hover:text-white rounded-md hover:bg-white/5 transition-colors"
            >
              Precios
            </Link>
          </li>
        </ul>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          {!loading && user ? (
            <Link
              href="/dashboard"
              className="px-4 py-1.5 text-sm bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium transition-colors shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
            >
              Ir al Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-4 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                Iniciar sesion
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 text-sm bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium transition-colors shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
              >
                Comenzar gratis
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => {
            setMobileOpen((v) => !v);
            if (mobileOpen) setProductoOpen(false);
          }}
          aria-label="Menu"
        >
          <span
            className={`block h-0.5 w-5 bg-white/70 transition-all origin-center ${mobileOpen ? "rotate-45 translate-y-2" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-white/70 transition-all ${mobileOpen ? "opacity-0 scale-x-0" : ""}`}
          />
          <span
            className={`block h-0.5 w-5 bg-white/70 transition-all origin-center ${mobileOpen ? "-rotate-45 -translate-y-2" : ""}`}
          />
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex flex-col gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {/* Producto accordion */}
          <button
            type="button"
            className="flex items-center justify-between py-2.5 text-sm text-white/70 hover:text-white border-b border-white/5 transition-colors"
            onClick={() => setProductoOpen((v) => !v)}
          >
            <span>Producto</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              className={`size-4 transition-transform duration-200 ${productoOpen ? "rotate-180" : ""}`}
            />
          </button>

          {productoOpen && (
            <div className="pl-2 pb-2 border-b border-white/5">
              {/* Plataforma */}
              <p className="px-2 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                Plataforma
              </p>
              {platformItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-teal-500/10 text-teal-400">
                    <HugeiconsIcon icon={item.icon} size={16} />
                  </div>
                  <span className="text-sm text-white/60">{item.name}</span>
                </Link>
              ))}

              {/* Proximamente */}
              <p className="px-2 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest text-white/25">
                Proximamente
              </p>
              {upcomingItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 transition-colors opacity-50"
                  onClick={() => setMobileOpen(false)}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5 text-white/40">
                    <HugeiconsIcon icon={item.icon} size={16} />
                  </div>
                  <span className="text-sm text-white/50">{item.name}</span>
                  <span className="ml-auto text-[9px] font-medium text-white/25 bg-white/5 rounded px-1.5 py-0.5">
                    Pronto
                  </span>
                </Link>
              ))}
            </div>
          )}

          <Link
            href="/#pricing"
            className="py-2.5 text-sm text-white/70 hover:text-white border-b border-white/5"
            onClick={() => setMobileOpen(false)}
          >
            Precios
          </Link>

          {/* CTAs */}
          <div className="pt-3 flex flex-col gap-2">
            {!loading && user ? (
              <Link
                href="/dashboard"
                className="py-2.5 text-sm text-center bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium"
              >
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="py-2.5 text-sm text-center text-white/70 hover:text-white border border-white/10 rounded-lg"
                >
                  Iniciar sesion
                </Link>
                <Link
                  href="/register"
                  className="py-2.5 text-sm text-center bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium"
                >
                  Comenzar gratis
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
