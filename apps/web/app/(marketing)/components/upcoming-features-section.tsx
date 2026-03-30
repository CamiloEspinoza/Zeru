"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  DocumentValidationIcon,
  PuzzleIcon,
  DashboardBrowsingIcon,
  ApiIcon,
  PackageIcon,
  Invoice02Icon,
  BankIcon,
  UserMultipleIcon,
  Store01Icon,
  Target01Icon,
  CreditCardIcon,
  CustomerServiceIcon,
  Megaphone01Icon,
  ThumbsUpIcon,
  Idea01Icon,
} from "@hugeicons/core-free-icons";

interface UpcomingFeature {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: typeof Calendar01Icon;
}

const upcomingFeatures: UpcomingFeature[] = [
  {
    id: "rrhh",
    name: "Gestión de RRHH",
    description:
      "Contratos, vacaciones, asistencia y evaluaciones de desempeño en una sola plataforma.",
    href: "/features/gestion-rrhh",
    icon: Calendar01Icon,
  },
  {
    id: "documental",
    name: "Gestión Documental",
    description:
      "Flujos de aprobación, firma electrónica y versionado de documentos empresariales.",
    href: "/features/gestion-documental",
    icon: DocumentValidationIcon,
  },
  {
    id: "reportes",
    name: "Reportes y BI",
    description:
      "Dashboards customizables, KPIs en tiempo real y análisis de datos avanzado.",
    href: "/features/reportes-bi",
    icon: DashboardBrowsingIcon,
  },
  {
    id: "integraciones",
    name: "Integraciones",
    description:
      "SAP, Google Workspace, Microsoft 365 y más. Conecta Zeru con tus herramientas.",
    href: "/features/integraciones",
    icon: PuzzleIcon,
  },
  {
    id: "api",
    name: "API Pública",
    description:
      "Endpoints RESTful, webhooks y SDK para integrar Zeru con tus sistemas.",
    href: "/features/api-publica",
    icon: ApiIcon,
  },
  {
    id: "inventario",
    name: "Inventario",
    description:
      "Control de stock, productos, movimientos y valorización en tiempo real.",
    href: "#",
    icon: PackageIcon,
  },
  {
    id: "dte",
    name: "Documentos Electrónicos (DTE)",
    description:
      "Emisión y recepción de facturas, boletas y notas de crédito vía SII.",
    href: "#",
    icon: Invoice02Icon,
  },
  {
    id: "conciliacion",
    name: "Conciliación Bancaria",
    description:
      "Importa cartolas y la IA concilia movimientos contra asientos contables automáticamente.",
    href: "#",
    icon: BankIcon,
  },
  {
    id: "oc",
    name: "Órdenes de Compra",
    description:
      "Flujo completo: cotización, orden de compra, recepción y contabilización automática.",
    href: "#",
    icon: CreditCardIcon,
  },
  {
    id: "crm",
    name: "CRM",
    description:
      "Auxiliar de clientes y proveedores con historial de operaciones e interacciones.",
    href: "#",
    icon: UserMultipleIcon,
  },
  {
    id: "venta",
    name: "Venta Online",
    description:
      "Tienda propia integrada al inventario, documentos electrónicos y medios de pago.",
    href: "#",
    icon: Store01Icon,
  },
  {
    id: "control",
    name: "Control de Gestión",
    description:
      "Dashboard de KPIs, márgenes por línea de negocio y análisis de rentabilidad.",
    href: "#",
    icon: Target01Icon,
  },
  {
    id: "atencion",
    name: "Atención al Cliente",
    description:
      "Bandeja unificada: WhatsApp, email e IA para respuestas automáticas.",
    href: "#",
    icon: CustomerServiceIcon,
  },
  {
    id: "outbound",
    name: "Marketing Outbound",
    description:
      "Campañas de email y WhatsApp segmentadas desde los datos de tu CRM.",
    href: "#",
    icon: Megaphone01Icon,
  },
];

function getVotes(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("zeru_feature_votes") ?? "{}");
  } catch {
    return {};
  }
}

function getUserVotes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("zeru_user_votes") ?? "[]");
  } catch {
    return [];
  }
}

export function UpcomingFeaturesSection() {
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [userVotes, setUserVotes] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionSent, setSuggestionSent] = useState(false);

  useEffect(() => {
    setVotes(getVotes());
    setUserVotes(getUserVotes());
  }, []);

  const handleVote = useCallback(
    (featureId: string) => {
      const alreadyVoted = userVotes.includes(featureId);

      const newVotes = { ...votes };
      const newUserVotes = [...userVotes];

      if (alreadyVoted) {
        newVotes[featureId] = Math.max((newVotes[featureId] ?? 0) - 1, 0);
        const idx = newUserVotes.indexOf(featureId);
        if (idx > -1) newUserVotes.splice(idx, 1);
      } else {
        newVotes[featureId] = (newVotes[featureId] ?? 0) + 1;
        newUserVotes.push(featureId);
      }

      setVotes(newVotes);
      setUserVotes(newUserVotes);
      localStorage.setItem("zeru_feature_votes", JSON.stringify(newVotes));
      localStorage.setItem("zeru_user_votes", JSON.stringify(newUserVotes));
    },
    [votes, userVotes],
  );

  const handleSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestion.trim()) return;
    // Store locally for now
    const suggestions = JSON.parse(
      localStorage.getItem("zeru_feature_suggestions") ?? "[]",
    );
    suggestions.push({
      text: suggestion.trim(),
      date: new Date().toISOString(),
    });
    localStorage.setItem(
      "zeru_feature_suggestions",
      JSON.stringify(suggestions),
    );
    setSuggestion("");
    setSuggestionSent(true);
    setTimeout(() => setSuggestionSent(false), 3000);
  };

  // Sort by votes (most voted first)
  const sortedFeatures = [...upcomingFeatures].sort(
    (a, b) => (votes[b.id] ?? 0) - (votes[a.id] ?? 0),
  );

  return (
    <section id="roadmap-features" className="py-28 px-6 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16 fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/50 text-xs font-medium mb-6">
            Lo que viene
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            Tú decides{" "}
            <span className="text-white/40">qué construimos primero</span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Vota por las funcionalidades que más necesitas. Las más votadas
            tendrán prioridad en nuestro roadmap.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedFeatures.map((feature, i) => {
            const voteCount = votes[feature.id] ?? 0;
            const hasVoted = userVotes.includes(feature.id);

            return (
              <div
                key={feature.id}
                className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-6 hover:border-white/12 hover:bg-white/[0.04] transition-all duration-300 fade-in-up flex flex-col"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {/* Vote count badge */}
                {voteCount > 0 && (
                  <div className="absolute -top-2 -right-2 flex items-center justify-center w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold shadow-lg shadow-teal-500/30">
                    {voteCount}
                  </div>
                )}

                {/* Icon */}
                <div className="mb-4 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white/60 group-hover:bg-white/8 transition-colors">
                  <HugeiconsIcon icon={feature.icon} size={20} />
                </div>

                {/* Content */}
                <h3 className="font-semibold text-white/70 group-hover:text-white mb-2 transition-colors">
                  {feature.name}
                </h3>
                <p className="text-sm text-white/35 leading-relaxed mb-4 flex-1">
                  {feature.description}
                </p>

                {/* Vote button + link */}
                <div className="flex items-center justify-between mt-auto pt-2">
                  <button
                    onClick={() => handleVote(feature.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      hasVoted
                        ? "bg-teal-500/20 text-teal-400 border border-teal-500/30 hover:bg-teal-500/30"
                        : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10 hover:text-white/70"
                    }`}
                  >
                    <HugeiconsIcon icon={ThumbsUpIcon} size={14} />
                    {hasVoted ? "Votado" : "Votar"}
                  </button>

                  {feature.href !== "#" && (
                    <Link
                      href={feature.href}
                      className="text-xs text-white/30 hover:text-teal-400 transition-colors inline-flex items-center gap-1"
                    >
                      Ver más
                      <svg
                        className="w-3 h-3"
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
                  )}
                </div>

                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/[0.02] group-hover:to-transparent transition-all duration-500 pointer-events-none" />
              </div>
            );
          })}

          {/* Suggest feature card */}
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] p-6 flex flex-col items-center justify-center text-center fade-in-up">
            <div className="mb-4 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/30">
              <HugeiconsIcon icon={Idea01Icon} size={20} />
            </div>
            <h3 className="font-semibold text-white/50 mb-2">
              ¿Echas algo en falta?
            </h3>
            <p className="text-xs text-white/30 mb-4 leading-relaxed">
              Propón una funcionalidad y la evaluaremos para el roadmap.
            </p>
            <form onSubmit={handleSuggestion} className="w-full space-y-2">
              <input
                type="text"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                placeholder="Describe tu idea..."
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/25 focus:border-teal-500/50 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
              />
              <button
                type="submit"
                disabled={!suggestion.trim()}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs font-medium text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {suggestionSent ? "¡Recibido! Gracias 🎉" : "Enviar propuesta"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
