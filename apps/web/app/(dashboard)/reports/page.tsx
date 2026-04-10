import { ChartColumnIcon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      icon={ChartColumnIcon}
      title="Reportes"
      description="Analítica transversal de todos los módulos. Dashboards personalizables, KPIs y exportación de datos."
      features={[
        "Dashboards con métricas clave de laboratorio, cobranzas y facturación",
        "Reportes cruzados entre módulos",
        "Filtros por período, cliente, tipo de examen y más",
        "Exportación a Excel y PDF",
        "KPIs configurables por área",
        "Reportes programados por email",
      ]}
    />
  );
}
