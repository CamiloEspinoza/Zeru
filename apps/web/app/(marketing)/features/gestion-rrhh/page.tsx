import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Calendar01Icon,
  ContractsIcon,
  User02Icon,
  AnalyticsUpIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Gestion de RRHH — Zeru",
  description:
    "Gestion integral de recursos humanos: contratos, vacaciones, asistencia y evaluaciones de desempeno. Proximamente en Zeru.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={ContractsIcon} size={20} />,
    title: "Gestion de contratos",
    description:
      "Administra contratos laborales con fechas de inicio, termino, renovaciones y alertas automaticas. Historial completo de cada colaborador.",
  },
  {
    icon: <HugeiconsIcon icon={Calendar01Icon} size={20} />,
    title: "Vacaciones y permisos",
    description:
      "Solicitudes de vacaciones, permisos y licencias con flujos de aprobacion. Calculo automatico de dias disponibles segun la ley chilena.",
  },
  {
    icon: <HugeiconsIcon icon={User02Icon} size={20} />,
    title: "Control de asistencia",
    description:
      "Registro de entrada y salida, horas extra y atrasos. Reportes mensuales listos para la liquidacion de sueldos.",
  },
  {
    icon: <HugeiconsIcon icon={AnalyticsUpIcon} size={20} />,
    title: "Evaluaciones de desempeno",
    description:
      "Ciclos de evaluacion 360, objetivos medibles y seguimiento de planes de desarrollo. La IA sugiere areas de mejora basandose en datos.",
  },
];

export default function GestionRrhhPage() {
  return (
    <FeaturePageLayout
      badge="Proximamente"
      badgeColor="gray"
      title="Gestion de RRHH"
      subtitle="Contratos, vacaciones, asistencia y evaluaciones de desempeno en una sola plataforma. Gestion integral de recursos humanos para empresas chilenas."
      features={features}
      isUpcoming
    />
  );
}
