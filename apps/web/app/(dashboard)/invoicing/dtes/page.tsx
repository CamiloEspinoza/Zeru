import { Invoice01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function DtesPage() {
  return (
    <ModulePlaceholder
      icon={Invoice01Icon}
      title="Documentos Tributarios Electrónicos"
      description="Emisión de documentos tributarios electrónicos: facturas, boletas, notas de crédito y débito. Integración directa con el SII."
      features={[
        "Emisión de Facturas Electrónicas (tipo 33) y Exentas (tipo 34)",
        "Boletas Electrónicas (tipo 39) y Exentas (tipo 41)",
        "Notas de Crédito (tipo 61) y Notas de Débito (tipo 56)",
        "Guías de Despacho Electrónicas (tipo 52)",
        "Facturación automática desde liquidaciones aprobadas",
        "Integración con SII para timbraje y envío",
      ]}
    />
  );
}
