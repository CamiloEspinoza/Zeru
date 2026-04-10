import { MedicalFileIcon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function LaboratoryReportsPage() {
  return (
    <ModulePlaceholder
      icon={MedicalFileIcon}
      title="Informes"
      description="Redacción, revisión y firma de informes anatomopatológicos. Gestión del ciclo de diagnóstico y entrega de resultados."
      features={[
        "Editor de informes con plantillas por tipo de examen",
        "Flujo de revisión y firma digital por patólogo",
        "Gestión de informes complementarios y adendas",
        "Entrega de resultados por email o portal del cliente",
        "Historial de versiones y auditoría de cambios",
        "Sincronización bidireccional con FileMaker",
      ]}
    />
  );
}
