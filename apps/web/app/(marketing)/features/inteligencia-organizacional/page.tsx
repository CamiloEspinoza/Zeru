import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AiBrain01Icon,
  AiSearch02Icon,
  AiNetworkIcon,
  Flowchart01Icon,
  Chart01Icon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Inteligencia Organizacional con IA — Zeru",
  description:
    "Transcribe entrevistas, extrae conocimiento, genera organigramas y diagnostica tu empresa automaticamente con inteligencia artificial.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={AiBrain01Icon} size={20} />,
    title: "Transcripcion con diarizacion",
    description:
      "Sube audios de entrevistas y Zeru los transcribe automaticamente con identificacion de quien habla. Soporta multiples formatos de audio.",
  },
  {
    icon: <HugeiconsIcon icon={AiSearch02Icon} size={20} />,
    title: "Extraccion en 5 pasadas",
    description:
      "GPT-5.4 analiza cada transcripcion en 5 pasadas independientes: hechos clave, problemas, dependencias, contradicciones y oportunidades de mejora.",
  },
  {
    icon: <HugeiconsIcon icon={AiNetworkIcon} size={20} />,
    title: "Knowledge Graph",
    description:
      "Construye un grafo de conocimiento organizacional que conecta personas, procesos, problemas y dependencias en una vista unificada.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    title: "Busqueda semantica",
    description:
      "Busca en todas las entrevistas usando lenguaje natural. La IA entiende el contexto y encuentra informacion relevante incluso si no usas las palabras exactas.",
  },
  {
    icon: <HugeiconsIcon icon={Flowchart01Icon} size={20} />,
    title: "Diagnostico automatico",
    description:
      "Identifica cuellos de botella, personas clave irremplazables, procesos ineficientes y genera diagramas AS-IS en formato Mermaid automaticamente.",
  },
  {
    icon: <HugeiconsIcon icon={Chart01Icon} size={20} />,
    title: "Plan de mejoras RICE",
    description:
      "Recibe un plan de mejoras priorizado con el framework RICE (Reach, Impact, Confidence, Effort) para saber por donde empezar.",
  },
];

const steps = [
  {
    number: 1,
    title: "Graba las entrevistas",
    description:
      "Realiza entrevistas de 30-60 minutos con tu equipo. Presencial, por Zoom o telefono — cualquier formato de audio funciona.",
  },
  {
    number: 2,
    title: "Sube los audios a Zeru",
    description:
      "Arrastra los archivos a la plataforma. En menos de 3 minutos, Zeru transcribe cada entrevista con diarizacion automatica.",
  },
  {
    number: 3,
    title: "La IA analiza todo",
    description:
      "GPT-5.4 procesa cada transcripcion en 5 pasadas independientes, extrae conocimiento y construye el Knowledge Graph organizacional.",
  },
  {
    number: 4,
    title: "Obten tu diagnostico",
    description:
      "Recibe un diagnostico completo con cuellos de botella, diagramas de procesos y un plan de mejoras priorizado listo para tomar decisiones.",
  },
];

export default function InteligenciaOrganizacionalPage() {
  return (
    <FeaturePageLayout
      badge="Modulo principal"
      badgeColor="teal"
      title="Inteligencia Organizacional con IA"
      subtitle="Transcribe entrevistas, extrae conocimiento, genera organigramas y diagnostica tu empresa automaticamente. Todo con inteligencia artificial por ~$0.65 por entrevista."
      features={features}
      steps={steps}
    />
  );
}
