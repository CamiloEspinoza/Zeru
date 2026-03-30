const ENTITY_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  ORGANIZATION: {
    label: "Organización",
    color: "text-slate-700 dark:text-slate-300",
    bgColor: "bg-slate-100 dark:bg-slate-900",
  },
  DEPARTMENT: {
    label: "Departamento",
    color: "text-blue-700 dark:text-blue-300",
    bgColor: "bg-blue-100 dark:bg-blue-900",
  },
  ROLE: {
    label: "Rol",
    color: "text-indigo-700 dark:text-indigo-300",
    bgColor: "bg-indigo-100 dark:bg-indigo-900",
  },
  PROCESS: {
    label: "Proceso",
    color: "text-emerald-700 dark:text-emerald-300",
    bgColor: "bg-emerald-100 dark:bg-emerald-900",
  },
  ACTIVITY: {
    label: "Actividad",
    color: "text-teal-700 dark:text-teal-300",
    bgColor: "bg-teal-100 dark:bg-teal-900",
  },
  SYSTEM: {
    label: "Sistema",
    color: "text-amber-700 dark:text-amber-300",
    bgColor: "bg-amber-100 dark:bg-amber-900",
  },
  DOCUMENT_TYPE: {
    label: "Documento",
    color: "text-orange-700 dark:text-orange-300",
    bgColor: "bg-orange-100 dark:bg-orange-900",
  },
  PROBLEM: {
    label: "Problema",
    color: "text-red-700 dark:text-red-300",
    bgColor: "bg-red-100 dark:bg-red-900",
  },
  IMPROVEMENT: {
    label: "Mejora",
    color: "text-green-700 dark:text-green-300",
    bgColor: "bg-green-100 dark:bg-green-900",
  },
};

interface EntityTypeBadgeProps {
  type: string;
  className?: string;
}

export function EntityTypeBadge({ type, className }: EntityTypeBadgeProps) {
  const config = ENTITY_TYPE_CONFIG[type] || {
    label: type,
    color: "text-gray-700 dark:text-gray-300",
    bgColor: "bg-gray-100 dark:bg-gray-900",
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
