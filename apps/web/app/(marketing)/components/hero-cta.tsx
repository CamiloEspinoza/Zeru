"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";

export function HeroCTA() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
        >
          Ir al Dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
          </svg>
        </Link>
        <a
          href="#funcionalidades"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl font-medium text-sm transition-all hover:bg-white/5"
        >
          Ver funcionalidades
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        href="/register"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl font-semibold text-sm transition-all shadow-xl shadow-teal-500/20 hover:shadow-teal-500/30 hover:-translate-y-0.5"
      >
        Comenzar gratis
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
      </Link>
      <a
        href="#funcionalidades"
        className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/10 hover:border-white/20 text-white/70 hover:text-white rounded-xl font-medium text-sm transition-all hover:bg-white/5"
      >
        Ver funcionalidades
      </a>
    </div>
  );
}
