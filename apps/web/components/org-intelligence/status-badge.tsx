import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  // Grays
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  // Blues
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  // Greens
  green: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  // Reds
  red: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  // Yellows
  yellow: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  // Purples
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  // Oranges
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  // Teals
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  // Indigo
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  // Emerald
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
};

// --- Project status ---
const PROJECT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: "Borrador", color: "gray" },
  ACTIVE: { label: "Activo", color: "blue" },
  COMPLETED: { label: "Completado", color: "green" },
  ARCHIVED: { label: "Archivado", color: "slate" },
};

// --- Interview processing status ---
const PROCESSING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "gray" },
  UPLOADED: { label: "Subido", color: "yellow" },
  TRANSCRIBING: { label: "Transcribiendo", color: "blue" },
  POST_PROCESSING: { label: "Post-procesando", color: "blue" },
  EXTRACTING: { label: "Extrayendo", color: "purple" },
  RESOLVING_COREFERENCES: { label: "Resolviendo", color: "purple" },
  SUMMARIZING: { label: "Resumiendo", color: "indigo" },
  CHUNKING: { label: "Indexando", color: "teal" },
  EMBEDDING: { label: "Embeddings", color: "teal" },
  COMPLETED: { label: "Completado", color: "green" },
  FAILED: { label: "Error", color: "red" },
};

// --- Problem severity ---
const SEVERITY_CONFIG: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: "Crítico", color: "red" },
  HIGH: { label: "Alto", color: "orange" },
  MEDIUM: { label: "Medio", color: "amber" },
  LOW: { label: "Bajo", color: "gray" },
};

// --- Conflict type ---
const CONFLICT_CONFIG: Record<string, { label: string; color: string }> = {
  FACTUAL: { label: "Factual", color: "red" },
  PERSPECTIVE: { label: "Perspectiva", color: "amber" },
  SCOPE: { label: "Alcance", color: "blue" },
};

// --- Improvement status ---
const IMPROVEMENT_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PROPOSED: { label: "Propuesta", color: "gray" },
  VALIDATED: { label: "Validada", color: "blue" },
  IN_PROGRESS: { label: "En progreso", color: "amber" },
  COMPLETED: { label: "Completada", color: "green" },
};

const ALL_CONFIGS: Record<string, Record<string, { label: string; color: string }>> = {
  project: PROJECT_STATUS_CONFIG,
  processing: PROCESSING_STATUS_CONFIG,
  severity: SEVERITY_CONFIG,
  conflict: CONFLICT_CONFIG,
  improvement: IMPROVEMENT_STATUS_CONFIG,
};

interface StatusBadgeProps {
  type: "project" | "processing" | "severity" | "conflict" | "improvement";
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const config = ALL_CONFIGS[type]?.[value];
  const label = config?.label ?? value;
  const colorKey = config?.color ?? "gray";
  const colorClasses = COLOR_MAP[colorKey] ?? COLOR_MAP.gray;

  return (
    <Badge variant="outline" className={cn("border-transparent", colorClasses, className)}>
      {label}
    </Badge>
  );
}

/** Get raw color classes for a color key (for inline usage without Badge) */
export function getStatusColor(colorKey: string): string {
  return COLOR_MAP[colorKey] ?? COLOR_MAP.gray;
}
