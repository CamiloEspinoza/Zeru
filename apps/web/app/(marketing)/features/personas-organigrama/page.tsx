import type { Metadata } from "next";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  HierarchyIcon,
  UserAccountIcon,
  Group01Icon,
  AiUserIcon,
  User02Icon,
} from "@hugeicons/core-free-icons";
import { FeaturePageLayout } from "../../components/feature-page-layout";

export const metadata: Metadata = {
  title: "Gestión de Personas y Organigrama — Zeru",
  description:
    "Directorio de personas con perfiles completos, organigrama interactivo, departamentos jerárquicos y sugerencias de IA para tu estructura organizacional.",
};

const features = [
  {
    icon: <HugeiconsIcon icon={UserAccountIcon} size={20} />,
    title: "Directorio con perfiles completos",
    description:
      "Cada persona tiene un perfil completo con foto, cargo, departamento, contacto y toda la información relevante centralizada en un solo lugar.",
  },
  {
    icon: <HugeiconsIcon icon={HierarchyIcon} size={20} />,
    title: "Organigrama interactivo",
    description:
      "Visualiza la estructura de tu empresa con un organigrama interactivo construido con React Flow. Navega, busca y explora las relaciones jerárquicas.",
  },
  {
    icon: <HugeiconsIcon icon={Group01Icon} size={20} />,
    title: "Departamentos jerárquicos",
    description:
      "Organiza tu empresa en departamentos y sub-departamentos con estructura jerárquica ilimitada. Cada departamento con su responsable y miembros.",
  },
  {
    icon: <HugeiconsIcon icon={User02Icon} size={20} />,
    title: "Personas internas y externas",
    description:
      "Gestiona tanto empleados como colaboradores externos, proveedores y consultores. Todos integrados en el mismo directorio con roles diferenciados.",
  },
  {
    icon: <HugeiconsIcon icon={AiUserIcon} size={20} />,
    title: "Sugerencias de IA",
    description:
      "La IA analiza las entrevistas y sugiere cambios en la estructura organizacional basándose en lo que las personas revelan sobre dependencias y cuellos de botella.",
  },
];

export default function PersonasOrganigramaPage() {
  return (
    <FeaturePageLayout
      badge="Activo"
      badgeColor="teal"
      title="Gestión de Personas y Organigrama"
      subtitle="Directorio de personas con perfiles completos, organigrama interactivo y estructura organizacional que se alimenta de la inteligencia de tu empresa."
      features={features}
    />
  );
}
