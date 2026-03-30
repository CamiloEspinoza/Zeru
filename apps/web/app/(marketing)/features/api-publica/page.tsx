import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ApiIcon,
  DocumentCodeIcon,
  ConnectIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "API Pública — Zeru",
  description:
    "Endpoints RESTful, webhooks y SDK para desarrolladores. Integra Zeru con tus sistemas existentes. Próximamente.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={ApiIcon} size={20} />,
    title: "Endpoints RESTful",
    description:
      "API REST completa y bien documentada para acceder a todos los recursos de Zeru. Autenticación vía API keys y OAuth 2.0.",
  },
  {
    icon: <HugeiconsIcon icon={ConnectIcon} size={20} />,
    title: "Webhooks",
    description:
      "Recibe notificaciones en tiempo real cuando ocurren eventos en Zeru. Configura webhooks personalizados para cada tipo de evento.",
  },
  {
    icon: <HugeiconsIcon icon={DocumentCodeIcon} size={20} />,
    title: "SDK para desarrolladores",
    description:
      "SDKs oficiales en TypeScript, Python y más. Documentación interactiva, ejemplos de código y sandbox para pruebas.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
    title: "Extensibilidad total",
    description:
      "Construye integraciones custom, automatizaciones y aplicaciones que aprovechan toda la inteligencia organizacional de Zeru.",
  },
];

export default function ApiPublicaPage() {
  return (
    <FeaturePageLayout
      badge="Próximamente"
      badgeColor="gray"
      title="API Pública"
      subtitle="Endpoints RESTful, webhooks y SDKs para desarrolladores. Integra Zeru con tus sistemas existentes y construye soluciones personalizadas sobre la plataforma."
      features={features}
      isUpcoming
    />
  );
}
