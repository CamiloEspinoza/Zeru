import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  PuzzleIcon,
  ConnectIcon,
  Share01Icon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Integraciones — Zeru",
  description:
    "Conecta Zeru con SAP, Google Workspace, Microsoft 365 y mas. Integraciones nativas para centralizar la informacion de tu empresa.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={PuzzleIcon} size={20} />,
    title: "SAP y ERPs",
    description:
      "Conecta con SAP Business One, SAP S/4HANA y otros ERPs para sincronizar datos contables, inventario y ordenes de compra automaticamente.",
  },
  {
    icon: <HugeiconsIcon icon={ConnectIcon} size={20} />,
    title: "Google Workspace",
    description:
      "Integracion con Gmail, Google Drive, Calendar y Docs. Importa documentos, sincroniza calendarios y centraliza la comunicacion.",
  },
  {
    icon: <HugeiconsIcon icon={Share01Icon} size={20} />,
    title: "Microsoft 365",
    description:
      "Conecta con Outlook, OneDrive, Teams y SharePoint. Accede a tus archivos y comunicaciones directamente desde Zeru.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7" />
      </svg>
    ),
    title: "Y muchas mas",
    description:
      "Slack, Notion, Jira, HubSpot y mas. El ecosistema de integraciones crece constantemente para conectar todas tus herramientas favoritas.",
  },
];

export default function IntegracionesPage() {
  return (
    <FeaturePageLayout
      badge="Proximamente"
      badgeColor="gray"
      title="Integraciones"
      subtitle="Conecta Zeru con las herramientas que ya usas. SAP, Google Workspace, Microsoft 365 y mas. Centraliza la informacion de tu empresa sin cambiar tu flujo de trabajo."
      features={features}
      isUpcoming
    />
  );
}
