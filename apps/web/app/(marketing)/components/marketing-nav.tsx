"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { label: "Funcionalidades", href: "#funcionalidades" },
    { label: "Roadmap", href: "#roadmap" },
    { label: "Open Source", href: "#opensource" },
    { label: "Creador", href: "#creador" },
  ];

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
        <Link href="/" className="font-semibold text-white tracking-tight hover:text-white/90 transition-colors">
          Zeru
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="px-3 py-1.5 text-sm text-white/60 hover:text-white rounded-md hover:bg-white/5 transition-colors"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/login"
            className="px-4 py-1.5 text-sm text-white/70 hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/register"
            className="px-4 py-1.5 text-sm bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium transition-colors shadow-lg shadow-teal-500/20 hover:shadow-teal-500/30"
          >
            Crear cuenta gratis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMobileOpen((v) => !v)}
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
        <div className="md:hidden bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/5 px-6 py-4 flex flex-col gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="py-2 text-sm text-white/70 hover:text-white border-b border-white/5 last:border-0"
              onClick={() => setMobileOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link
              href="/login"
              className="py-2 text-sm text-center text-white/70 hover:text-white border border-white/10 rounded-lg"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="py-2 text-sm text-center bg-teal-500 hover:bg-teal-400 text-white rounded-lg font-medium"
            >
              Crear cuenta gratis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
