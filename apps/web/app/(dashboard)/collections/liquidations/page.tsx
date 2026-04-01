import { MoneyReceive01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function LiquidationsPage() {
  return (
    <ModulePlaceholder
      icon={MoneyReceive01Icon}
      title="Liquidaciones"
      description="Agrupa exámenes codificados en notas de cobro por cliente y período. Configura reglas de agrupación y automatiza el ciclo de liquidación."
      features={[
        "Generación automática de liquidaciones según perfil de cliente",
        "Agrupación configurable: por sucursal, convenio, tipo de examen",
        "Ciclo de vida: Borrador → Aprobada → Enviada → Cobrada",
        "Vista detallada de items cobrables por liquidación",
        "Exportación en PDF y Excel para envío a clientes",
      ]}
    />
  );
}
