"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const GLOSSARY: Record<string, string> = {
  levantamiento:
    "Proceso formal de recopilar información sobre cómo funciona una organización a través de entrevistas estructuradas.",
  entidad:
    "Elemento identificado en las entrevistas: puede ser un departamento, rol, proceso, sistema, problema u oportunidad de mejora.",
  "knowledge-graph":
    "Mapa de relaciones entre todas las entidades detectadas. Permite ver cómo se conectan áreas, roles, procesos y sistemas.",
  confianza:
    "Porcentaje que indica qué tan segura está la IA de la información extraída. 100% = mencionado explícitamente, <50% = requiere validación humana.",
  spof: "Punto Único de Fallo (Single Point of Failure). Persona o sistema del que dependen muchos procesos. Si falla, múltiples áreas se ven afectadas.",
  "cuello-de-botella":
    "Punto en la organización donde se concentran muchas dependencias, causando demoras o congestión en los flujos de trabajo.",
  rice: "Método de priorización: Reach (alcance) x Impact (impacto) x Confidence (confianza) / Effort (esfuerzo). Mayor puntaje = mayor prioridad.",
  diarizacion:
    "Proceso de identificar automáticamente quién habla en cada momento de una grabación de audio.",
  extraccion:
    "Proceso de IA que analiza el texto de una entrevista para identificar roles, procesos, problemas, dependencias y métricas.",
  "proceso-as-is":
    "Representación del proceso tal como funciona actualmente, antes de proponer mejoras.",
  "quick-win":
    "Mejora de alto impacto y bajo esfuerzo que se puede implementar rápidamente para generar resultados visibles.",
  reconciliacion:
    "Cruce de información entre múltiples entrevistas para detectar coincidencias, contradicciones y complementos.",
};

interface GlossaryTermProps {
  term: string;
  children?: React.ReactNode;
  className?: string;
}

export function GlossaryTerm({ term, children, className }: GlossaryTermProps) {
  const definition = GLOSSARY[term.toLowerCase()];

  if (!definition) {
    return <span className={className}>{children ?? term}</span>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "cursor-help border-b border-dashed border-muted-foreground/40 text-foreground transition-colors hover:border-foreground",
              className,
            )}
            tabIndex={0}
          >
            {children ?? term}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-left">
          <p className="mb-1 text-xs font-semibold capitalize">
            {term.replace(/-/g, " ")}
          </p>
          <p className="text-xs">{definition}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Utility to get all glossary entries */
export function getGlossary() {
  return GLOSSARY;
}
