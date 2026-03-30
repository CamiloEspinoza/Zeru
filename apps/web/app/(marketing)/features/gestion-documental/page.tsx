import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  DocumentValidationIcon,
  Flowchart01Icon,
  FileAttachmentIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Gestión Documental — Zeru",
  description:
    "Flujos de aprobación, firma electrónica y versionado de documentos. Gestiona todo el ciclo de vida de tus documentos. Próximamente en Zeru.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={Flowchart01Icon} size={20} />,
    title: "Flujos de aprobación",
    description:
      "Diseña flujos de aprobación personalizados con múltiples niveles. Notificaciones automáticas y escalamiento cuando se vencen los plazos.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    title: "Firma electrónica",
    description:
      "Firma documentos de forma electrónica con validez legal. Múltiples firmantes, orden de firma y certificados digitales.",
  },
  {
    icon: <HugeiconsIcon icon={FileAttachmentIcon} size={20} />,
    title: "Versionado de documentos",
    description:
      "Historial completo de versiones para cada documento. Compara versiones, restaura anteriores y mantiene un registro de auditoría.",
  },
  {
    icon: <HugeiconsIcon icon={DocumentValidationIcon} size={20} />,
    title: "Ciclo de vida completo",
    description:
      "Desde la creación hasta el archivado. Gestiona todo el ciclo de vida de tus documentos con políticas de retención y clasificación automática.",
  },
];

export default function GestionDocumentalPage() {
  return (
    <FeaturePageLayout
      badge="Próximamente"
      badgeColor="gray"
      title="Gestión Documental"
      subtitle="Flujos de aprobación, firma electrónica y versionado. Gestiona todo el ciclo de vida de tus documentos empresariales en un solo lugar."
      features={features}
      isUpcoming
    />
  );
}
