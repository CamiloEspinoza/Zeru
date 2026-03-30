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
} from "@hugeicons/core-free-icons";

const upcomingFeatures = [
  {
    name: "Gestión de RRHH",
    description:
      "Contratos, vacaciones, asistencia y evaluaciones de desempeño en una sola plataforma.",
    href: "/features/gestion-rrhh",
    icon: Calendar01Icon,
    quarter: "Q2 2026",
  },
  {
    name: "Gestión Documental",
    description:
      "Flujos de aprobación, firma electrónica y versionado de documentos empresariales.",
    href: "/features/gestion-documental",
    icon: DocumentValidationIcon,
    quarter: "Q2 2026",
  },
  {
    name: "Reportes y BI",
    description:
      "Dashboards customizables, KPIs en tiempo real y análisis de datos avanzado.",
    href: "/features/reportes-bi",
    icon: DashboardBrowsingIcon,
    quarter: "Q3 2026",
  },
  {
    name: "Integraciones",
    description:
      "SAP, Google Workspace, Microsoft 365 y más. Conecta Zeru con tus herramientas.",
    href: "/features/integraciones",
    icon: PuzzleIcon,
    quarter: "Q3 2026",
  },
  {
    name: "API Pública",
    description:
      "Endpoints RESTful, webhooks y SDK para integrar Zeru con tus sistemas.",
    href: "/features/api-publica",
    icon: ApiIcon,
    quarter: "Q3 2026",
  },
  {
    name: "Inventario",
    description:
      "Control de stock, productos, movimientos y valorización en tiempo real.",
    href: "#",
    icon: PackageIcon,
    quarter: "Q3 2026",
  },
  {
    name: "Documentos Electrónicos (DTE)",
    description:
      "Emisión y recepción de facturas, boletas y notas de crédito vía SII.",
    href: "#",
    icon: Invoice02Icon,
    quarter: "Q4 2026",
  },
  {
    name: "Conciliación Bancaria",
    description:
      "Importa cartolas y la IA concilia movimientos contra asientos contables automáticamente.",
    href: "#",
    icon: BankIcon,
    quarter: "Q4 2026",
  },
  {
    name: "Órdenes de Compra",
    description:
      "Flujo completo: cotización, orden de compra, recepción y contabilización automática.",
    href: "#",
    icon: CreditCardIcon,
    quarter: "Q4 2026",
  },
  {
    name: "CRM",
    description:
      "Auxiliar de clientes y proveedores con historial de operaciones e interacciones.",
    href: "#",
    icon: UserMultipleIcon,
    quarter: "2027",
  },
  {
    name: "Venta Online",
    description:
      "Tienda propia integrada al inventario, documentos electrónicos y medios de pago.",
    href: "#",
    icon: Store01Icon,
    quarter: "2027",
  },
  {
    name: "Control de Gestión",
    description:
      "Dashboard de KPIs, márgenes por línea de negocio y análisis de rentabilidad.",
    href: "#",
    icon: Target01Icon,
    quarter: "2027",
  },
  {
    name: "Atención al Cliente",
    description:
      "Bandeja unificada: WhatsApp, email e IA para respuestas automáticas.",
    href: "#",
    icon: CustomerServiceIcon,
    quarter: "2027",
  },
  {
    name: "Marketing Outbound",
    description:
      "Campañas de email y WhatsApp segmentadas desde los datos de tu CRM.",
    href: "#",
    icon: Megaphone01Icon,
    quarter: "2027",
  },
];

export function UpcomingFeaturesSection() {
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
            Estamos construyendo{" "}
            <span className="text-white/40">
              la plataforma empresarial más completa de Latinoamérica
            </span>
          </h2>
          <p className="text-white/50 text-lg leading-relaxed">
            Nuevos módulos en desarrollo para cubrir todas las necesidades de tu
            empresa. Desde RRHH hasta integraciones con tus herramientas favoritas.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {upcomingFeatures.map((feature, i) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="group relative rounded-2xl border border-white/6 bg-white/[0.02] p-6 hover:border-white/12 hover:bg-white/[0.04] transition-all duration-300 fade-in-up"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* Quarter badge */}
              <div className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-white/5 border border-white/10 text-white/35 mb-4">
                {feature.quarter}
              </div>

              {/* Icon */}
              <div className="mb-4 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 group-hover:text-white/60 group-hover:bg-white/8 transition-colors">
                <HugeiconsIcon icon={feature.icon} size={20} />
              </div>

              {/* Content */}
              <h3 className="font-semibold text-white/70 group-hover:text-white mb-2 transition-colors">
                {feature.name}
              </h3>
              <p className="text-sm text-white/35 leading-relaxed mb-4">
                {feature.description}
              </p>

              {/* Link text */}
              <span className="text-xs text-white/30 group-hover:text-teal-400 transition-colors inline-flex items-center gap-1">
                Más información
                <svg
                  className="w-3 h-3 transition-transform group-hover:translate-x-0.5"
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
              </span>

              {/* Hover glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/0 to-white/0 group-hover:from-white/[0.02] group-hover:to-transparent transition-all duration-500 pointer-events-none" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
