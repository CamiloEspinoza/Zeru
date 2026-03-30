import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calculator01Icon,
  Chart02Icon,
  Calendar01Icon,
  AnalyticsUpIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Contabilidad Inteligente — Zeru",
  description:
    "Plan de cuentas SII, libro diario, balance general, periodos fiscales y estructura contable lista para operar con normativa chilena.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={Calculator01Icon} size={20} />,
    title: "Plan de cuentas",
    description:
      "Plan de cuentas preconfigurado segun normativa SII chilena. Personalizable para tu empresa con cuentas auxiliares y centros de costo.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
    title: "Libro diario",
    description:
      "Registro de asientos contables con partida doble. Busqueda, filtros por fecha y cuenta, y validacion automatica de cuadraturas.",
  },
  {
    icon: <HugeiconsIcon icon={Chart02Icon} size={20} />,
    title: "Balance general y libro mayor",
    description:
      "Genera el balance general y libro mayor en tiempo real. Visualiza la situacion financiera de tu empresa en cualquier momento.",
  },
  {
    icon: <HugeiconsIcon icon={Calendar01Icon} size={20} />,
    title: "Periodos fiscales",
    description:
      "Gestion de periodos fiscales con apertura y cierre controlado. Bloquea periodos cerrados para proteger la integridad de los datos.",
  },
  {
    icon: <HugeiconsIcon icon={AnalyticsUpIcon} size={20} />,
    title: "Normativa chilena",
    description:
      "Estructura contable alineada con la normativa del SII. Plan de cuentas, clasificaciones y reportes preparados para la realidad tributaria chilena.",
  },
];

export default function ContabilidadPage() {
  return (
    <FeaturePageLayout
      badge="Activo"
      badgeColor="teal"
      title="Contabilidad Inteligente"
      subtitle="Plan de cuentas SII, libro diario, balance general y periodos fiscales. Toda la contabilidad de tu empresa en un solo lugar, lista para operar desde el dia uno."
      features={features}
    />
  );
}
