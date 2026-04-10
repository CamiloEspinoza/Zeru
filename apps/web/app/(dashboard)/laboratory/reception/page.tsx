import { InboxIcon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ReceptionPage() {
  return (
    <ModulePlaceholder
      icon={InboxIcon}
      title="Recepción"
      description="Ingreso y registro de muestras de anatomía patológica. Creación de casos, asignación de pacientes y trazabilidad desde la recepción."
      features={[
        "Registro de muestras con datos de paciente y médico derivador",
        "Creación de casos con número correlativo",
        "Asignación de tipo de frasco y tipo de muestra",
        "Registro de hipótesis diagnóstica",
        "Trazabilidad completa desde la recepción hasta el informe",
        "Sincronización bidireccional con FileMaker",
      ]}
    />
  );
}
