import { BarCode01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CodingPage() {
  return (
    <ModulePlaceholder
      icon={BarCode01Icon}
      title="Codificación"
      description="Asignación de códigos FONASA a exámenes según reglas configurables por cliente: tipo de frasco, muestra e hipótesis diagnóstica."
      features={[
        "Motor de reglas automáticas: frasco + muestra + hipótesis → código FONASA",
        "Reglas configurables por cliente y contrato",
        "Codificación automática con revisión manual de excepciones",
        "Generación de items cobrables hacia el módulo de Cobranzas",
        "Catálogo de códigos FONASA actualizable",
        "Dashboard de exámenes pendientes de codificar",
      ]}
    />
  );
}
