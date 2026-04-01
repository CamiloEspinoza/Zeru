import { MicroscopeIcon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ProcessingPage() {
  return (
    <ModulePlaceholder
      icon={MicroscopeIcon}
      title="Procesamiento"
      description="Workflow del laboratorio: macroscopía, inclusión, corte, tinción e inmunohistoquímica. Seguimiento del estado de cada muestra."
      features={[
        "Estaciones de trabajo: macroscopía, inclusión, corte, tinción",
        "Seguimiento en tiempo real del estado de cada muestra",
        "Gestión de tinciones especiales e inmunohistoquímica (IHQ)",
        "Control de tiempos de procesamiento por etapa",
        "Alertas de muestras con retraso o pendientes",
        "Sincronización bidireccional con FileMaker",
      ]}
    />
  );
}
