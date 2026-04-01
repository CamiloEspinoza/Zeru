import { Building03Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function ClientsPage() {
  return (
    <ModulePlaceholder
      icon={Building03Icon}
      title="Clientes"
      description="Gestión de clientes, instituciones y médicos derivadores. Administra perfiles de cobranza, contratos y contactos de facturación."
      features={[
        "Directorio de clientes con datos de contacto y facturación",
        "Perfil de cobranza configurable por cliente",
        "Gestión de contratos y convenios de precios",
        "Contactos de cobro y escalamiento",
        "Historial de documentos y transacciones por cliente",
      ]}
    />
  );
}
