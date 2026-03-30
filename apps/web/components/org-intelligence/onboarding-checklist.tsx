"use client";

import { useState } from "react";
import { useFirstVisit } from "@/hooks/use-first-visit";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "register-persons",
    title: "Registrar personas en el directorio",
    description: "Agrega las personas clave que serán entrevistadas.",
  },
  {
    id: "create-project",
    title: "Crear un proyecto",
    description: "Organiza el levantamiento bajo un proyecto.",
  },
  {
    id: "create-interview",
    title: "Crear una entrevista",
    description: "Define la entrevista y asigna un proyecto.",
  },
  {
    id: "configure-participants",
    title: "Configurar participantes",
    description: "Indica quiénes participan en cada entrevista.",
  },
  {
    id: "upload-audio",
    title: "Subir audio",
    description: "Sube la grabación de la entrevista.",
  },
  {
    id: "process-ai",
    title: "Procesar con IA",
    description:
      "Transcribe, extrae entidades y genera el análisis automático.",
  },
  {
    id: "review-results",
    title: "Revisar resultados",
    description:
      "Valida las entidades, relaciones y diagnóstico generados.",
  },
] as const;

interface OnboardingChecklistProps {
  completedSteps?: string[];
  onDismiss: () => void;
  className?: string;
}

export function OnboardingChecklist({
  completedSteps = [],
  onDismiss,
  className,
}: OnboardingChecklistProps) {
  const { isFirstVisit } = useFirstVisit("onboarding_checklist");
  const [isOpen, setIsOpen] = useState(true);

  const completedSet = new Set(completedSteps);
  const completedCount = STEPS.filter((s) => completedSet.has(s.id)).length;
  const progressPct = Math.round((completedCount / STEPS.length) * 100);

  if (!isFirstVisit) return null;

  return (
    <Card className={cn("overflow-visible", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-left"
              >
                <svg
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    isOpen && "rotate-90",
                  )}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
                <CardTitle>
                  Primer levantamiento
                </CardTitle>
              </button>
            </CollapsibleTrigger>
            <span className="ml-auto text-xs text-muted-foreground">
              {completedCount} de {STEPS.length}
            </span>
          </div>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              Descartar
            </Button>
          </CardAction>
          <div className="col-span-full mt-1">
            <Progress value={progressPct} className="h-1.5" />
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent>
            <ol className="space-y-3">
              {STEPS.map((step, idx) => {
                const done = completedSet.has(step.id);
                return (
                  <li key={step.id} className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium",
                        done
                          ? "border-emerald-500 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "border-muted-foreground/30 text-muted-foreground",
                      )}
                    >
                      {done ? (
                        <svg
                          className="size-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div>
                      <p
                        className={cn(
                          "text-sm font-medium",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
