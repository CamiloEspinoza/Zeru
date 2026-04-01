import { Plug01Icon } from "@hugeicons/core-free-icons";
import { ModulePlaceholder } from "@/components/module-placeholder";

export default function IntegrationsPage() {
  return (
    <ModulePlaceholder
      icon={Plug01Icon}
      title="Integraciones"
      description="Conexiones con sistemas externos: bridge FileMaker, SII, APIs de terceros. Monitoreo del estado de sincronización."
      features={[
        "Bridge bidireccional con FileMaker vía API",
        "Estado de sincronización en tiempo real por módulo",
        "Integración con SII para facturación electrónica",
        "Log de errores y reintentos automáticos",
        "Configuración de webhooks y endpoints externos",
        "Panel de salud de cada integración activa",
      ]}
    />
  );
}
