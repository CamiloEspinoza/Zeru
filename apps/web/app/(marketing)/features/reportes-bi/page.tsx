import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DashboardBrowsingIcon,
  AnalyticsUpIcon,
  Chart01Icon,
  BarChartIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Reportes y Business Intelligence — Zeru",
  description:
    "Dashboards customizables, KPIs en tiempo real y análisis de datos para tomar mejores decisiones. Próximamente en Zeru.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={DashboardBrowsingIcon} size={20} />,
    title: "Dashboards customizables",
    description:
      "Crea dashboards personalizados con widgets arrastrables. Cada rol ve los datos que necesita con visualizaciones adaptadas a su contexto.",
  },
  {
    icon: <HugeiconsIcon icon={AnalyticsUpIcon} size={20} />,
    title: "KPIs en tiempo real",
    description:
      "Define y monitorea indicadores clave de rendimiento en tiempo real. Alertas automáticas cuando un KPI se desvíe de su meta.",
  },
  {
    icon: <HugeiconsIcon icon={Chart01Icon} size={20} />,
    title: "Análisis de tendencias",
    description:
      "Visualiza tendencias históricas, comparativas entre períodos y proyecciones. La IA detecta patrones y anomalías automáticamente.",
  },
  {
    icon: <HugeiconsIcon icon={BarChartIcon} size={20} />,
    title: "Reportes exportables",
    description:
      "Exporta reportes en PDF, Excel y otros formatos. Programa envíos automáticos por email a stakeholders clave.",
  },
];

export default function ReportesBiPage() {
  return (
    <FeaturePageLayout
      badge="Próximamente"
      badgeColor="gray"
      title="Reportes y Business Intelligence"
      subtitle="Dashboards customizables, KPIs en tiempo real y análisis de datos avanzado. Toma mejores decisiones con la información de toda tu organización en un solo lugar."
      features={features}
      isUpcoming
    />
  );
}
