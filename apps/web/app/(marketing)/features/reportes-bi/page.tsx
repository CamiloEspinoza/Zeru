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
    "Dashboards customizables, KPIs en tiempo real y analisis de datos para tomar mejores decisiones. Proximamente en Zeru.",
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
      "Define y monitorea indicadores clave de rendimiento en tiempo real. Alertas automaticas cuando un KPI se desvie de su meta.",
  },
  {
    icon: <HugeiconsIcon icon={Chart01Icon} size={20} />,
    title: "Analisis de tendencias",
    description:
      "Visualiza tendencias historicas, comparativas entre periodos y proyecciones. La IA detecta patrones y anomalias automaticamente.",
  },
  {
    icon: <HugeiconsIcon icon={BarChartIcon} size={20} />,
    title: "Reportes exportables",
    description:
      "Exporta reportes en PDF, Excel y otros formatos. Programa envios automaticos por email a stakeholders clave.",
  },
];

export default function ReportesBiPage() {
  return (
    <FeaturePageLayout
      badge="Proximamente"
      badgeColor="gray"
      title="Reportes y Business Intelligence"
      subtitle="Dashboards customizables, KPIs en tiempo real y analisis de datos avanzado. Toma mejores decisiones con la informacion de toda tu organizacion en un solo lugar."
      features={features}
      isUpcoming
    />
  );
}
