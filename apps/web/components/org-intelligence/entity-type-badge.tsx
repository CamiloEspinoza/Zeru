const ENTITY_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  ORGANIZATION: {
    label: "Organización",
    color: "text-slate-700",
    bgColor: "bg-slate-100",
  },
  DEPARTMENT: {
    label: "Departamento",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
  },
  ROLE: {
    label: "Rol",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
  },
  PROCESS: {
    label: "Proceso",
    color: "text-emerald-700",
    bgColor: "bg-emerald-100",
  },
  ACTIVITY: {
    label: "Actividad",
    color: "text-teal-700",
    bgColor: "bg-teal-100",
  },
  SYSTEM: {
    label: "Sistema",
    color: "text-amber-700",
    bgColor: "bg-amber-100",
  },
  DOCUMENT_TYPE: {
    label: "Documento",
    color: "text-orange-700",
    bgColor: "bg-orange-100",
  },
  PROBLEM: {
    label: "Problema",
    color: "text-red-700",
    bgColor: "bg-red-100",
  },
  IMPROVEMENT: {
    label: "Mejora",
    color: "text-green-700",
    bgColor: "bg-green-100",
  },
};

interface EntityTypeBadgeProps {
  type: string;
  className?: string;
}

export function EntityTypeBadge({ type, className }: EntityTypeBadgeProps) {
  const config = ENTITY_TYPE_CONFIG[type] || {
    label: type,
    color: "text-gray-700",
    bgColor: "bg-gray-100",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${className || ""}`}
    >
      {config.label}
    </span>
  );
}

export { ENTITY_TYPE_CONFIG };
