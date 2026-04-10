import { MoneyReceive01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function CollectionsTrackingPage() {
  return (
    <ModulePlaceholder
      icon={MoneyReceive01Icon}
      title="Seguimiento de Cobranza"
      description="Monitorea el estado de cobro de liquidaciones y facturas. Controla vencimientos, avisos automáticos y escalamiento de mora."
      features={[
        "Dashboard de cuentas por cobrar con aging de cartera",
        "Secuencia de avisos automáticos configurable por cliente",
        "Escalamiento a jefatura o área legal según reglas",
        "Registro de gestiones de cobro y compromisos de pago",
        "Indicadores de morosidad y eficiencia de cobranza",
      ]}
    />
  );
}
