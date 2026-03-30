import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ChatBotIcon,
  FileAttachmentIcon,
  AiBrain01Icon,
  PuzzleIcon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Asistente IA Empresarial — Zeru",
  description:
    "Chat inteligente con GPT-5.4 que entiende el contexto de tu empresa. Soporte de archivos, memoria contextual y skills extensibles.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={ChatBotIcon} size={20} />,
    title: "Chat con GPT-5.4",
    description:
      "Conversa con un asistente de IA que entiende el contexto de tu empresa. Respuestas inteligentes basadas en el conocimiento organizacional acumulado.",
  },
  {
    icon: <HugeiconsIcon icon={FileAttachmentIcon} size={20} />,
    title: "Soporte de archivos",
    description:
      "Sube PDFs, imagenes, Excel y otros documentos. La IA los procesa y puede responder preguntas sobre su contenido o extraer informacion relevante.",
  },
  {
    icon: <HugeiconsIcon icon={AiBrain01Icon} size={20} />,
    title: "Memoria contextual",
    description:
      "El asistente recuerda conversaciones anteriores y mantiene el contexto entre sesiones. Comprension de contexto automatica para optimizar costos.",
  },
  {
    icon: <HugeiconsIcon icon={PuzzleIcon} size={20} />,
    title: "Skills extensibles",
    description:
      "Agrega nuevas capacidades al asistente con skills personalizados. Instala skills desde el marketplace o crea los tuyos propios con la API abierta.",
  },
];

export default function AsistenteIaPage() {
  return (
    <FeaturePageLayout
      badge="Activo"
      badgeColor="teal"
      title="Asistente IA Empresarial"
      subtitle="Un chat inteligente que entiende tu empresa, procesa documentos y se extiende con skills personalizados. Potenciado por GPT-5.4 con memoria contextual."
      features={features}
    />
  );
}
