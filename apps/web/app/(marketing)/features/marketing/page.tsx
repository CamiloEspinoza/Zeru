import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Megaphone01Icon,
  Linkedin01Icon,
  Share01Icon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Marketing con IA — Zeru",
  description:
    "Genera posts profesionales con IA, gestiona tu contenido y publica directamente en LinkedIn desde Zeru.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={Megaphone01Icon} size={20} />,
    title: "Generacion de posts con IA",
    description:
      "La IA genera posts profesionales adaptados a tu tono de voz y audiencia. Edita, refina y aprueba antes de publicar. Ahorra horas de redaccion.",
  },
  {
    icon: <HugeiconsIcon icon={Linkedin01Icon} size={20} />,
    title: "Integracion con LinkedIn",
    description:
      "Conecta tu cuenta de LinkedIn directamente con Zeru. Gestiona tu contenido, programa publicaciones y mide el rendimiento desde un solo lugar.",
  },
  {
    icon: <HugeiconsIcon icon={Share01Icon} size={20} />,
    title: "Publicacion directa",
    description:
      "Publica directamente en LinkedIn sin salir de Zeru. Programa tus posts para el mejor horario y mantiene tu presencia activa automaticamente.",
  },
];

export default function MarketingPage() {
  return (
    <FeaturePageLayout
      badge="Activo"
      badgeColor="teal"
      title="Marketing con IA"
      subtitle="Genera posts profesionales con inteligencia artificial, gestiona tu contenido y publica directamente en LinkedIn. Mantiene tu presencia activa sin invertir horas en redaccion."
      features={features}
    />
  );
}
