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
  title: "Gestión de RRHH — Zeru",
  description:
    "Gestión integral de recursos humanos: contratos, vacaciones, asistencia y evaluaciones de desempeño. Próximamente en Zeru.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={ContractsIcon} size={20} />,
    title: "Gestión de contratos",
    description:
      "Administra contratos laborales con fechas de inicio, término, renovaciones y alertas automáticas. Historial completo de cada colaborador.",
  },
  {
    icon: <HugeiconsIcon icon={Calendar01Icon} size={20} />,
    title: "Vacaciones y permisos",
    description:
      "Solicitudes de vacaciones, permisos y licencias con flujos de aprobación. Cálculo automático de días disponibles según la ley chilena.",
  },
  {
    icon: <HugeiconsIcon icon={User02Icon} size={20} />,
    title: "Control de asistencia",
    description:
      "Registro de entrada y salida, horas extra y atrasos. Reportes mensuales listos para la liquidación de sueldos.",
  },
  {
    icon: <HugeiconsIcon icon={AnalyticsUpIcon} size={20} />,
    title: "Evaluaciones de desempeño",
    description:
      "Ciclos de evaluación 360, objetivos medibles y seguimiento de planes de desarrollo. La IA sugiere áreas de mejora basándose en datos.",
  },
];

export default function GestionRrhhPage() {
  return (
    <FeaturePageLayout
      badge="Próximamente"
      badgeColor="gray"
      title="Gestión de RRHH"
      subtitle="Contratos, vacaciones, asistencia y evaluaciones de desempeño en una sola plataforma. Gestión integral de recursos humanos para empresas chilenas."
      features={features}
      isUpcoming
    />
  );
}
