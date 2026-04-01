"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HelpTooltip } from "@/components/org-intelligence/help-tooltip";
import {
  pipelineSteps,
  pipelineStepLabels,
  pipelineStepDescriptions,
} from "@/lib/org-intelligence/pipeline-config";
import type { PipelineLogEntry } from "@zeru/shared";

interface PipelineStatusCardProps {
  currentStatus: string;
  pipelineLog: PipelineLogEntry[];
  processingError: string | null;
  onRetry?: () => void;
}

export function PipelineStatusCard({
  currentStatus,
  pipelineLog,
  processingError,
}: PipelineStatusCardProps) {
  const currentStepIndex = pipelineSteps.indexOf(currentStatus);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>Estado del Procesamiento</CardTitle>
          <HelpTooltip
            iconSize="md"
            text={
              <div className="space-y-1.5 py-1">
                <p><strong>Subido:</strong> Audio recibido correctamente.</p>
                <p><strong>Transcribiendo:</strong> Convirtiendo audio a texto con identificación de hablantes (Deepgram Nova-3).</p>
                <p><strong>Post-procesando:</strong> Limpiando y estructurando la transcripción.</p>
                <p><strong>Extrayendo:</strong> Extrayendo roles, procesos, problemas y dependencias con IA (5 pasadas).</p>
                <p><strong>Reconciliando:</strong> Resolviendo entidades duplicadas y co-referencias.</p>
                <p><strong>Resumiendo:</strong> Generando resúmenes de cada segmento.</p>
                <p><strong>Fragmentando:</strong> Dividiendo la transcripción para búsqueda semántica.</p>
                <p><strong>Indexando:</strong> Generando embeddings vectoriales.</p>
                <p><strong>Completado:</strong> Resultados disponibles en Análisis y Diagnóstico.</p>
              </div>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {pipelineSteps.map((step, i) => {
            const stepIndex = pipelineSteps.indexOf(step);
            const isDone = stepIndex < currentStepIndex;
            const isCurrent = stepIndex === currentStepIndex;
            const isFailed = currentStatus === "FAILED" && isCurrent;

            return (
              <React.Fragment key={step}>
                {i > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${isDone ? "bg-green-500" : "bg-muted-foreground/20"}`}
                  />
                )}
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                      isFailed
                        ? "bg-red-100 text-red-800"
                        : isDone
                          ? "bg-green-100 text-green-800"
                          : isCurrent
                            ? "bg-blue-100 text-blue-800"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isFailed ? "!" : isDone ? "\u2713" : i + 1}
                  </div>
                  <span
                    className={`text-[10px] ${isCurrent || isDone ? "font-medium text-foreground" : "text-muted-foreground"}`}
                  >
                    {pipelineStepLabels[step]}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {currentStatus !== "COMPLETED" &&
          currentStatus !== "FAILED" &&
          currentStatus !== "UPLOADED" &&
          pipelineStepDescriptions[currentStatus] && (
            <p className="mt-4 text-xs text-muted-foreground">
              {pipelineStepDescriptions[currentStatus]}
            </p>
          )}

        {currentStatus === "FAILED" && (
          <p className="mt-4 text-xs text-red-600">
            Error: {processingError ?? "Error desconocido"}
          </p>
        )}

        {pipelineLog.length > 0 && currentStatus !== "UPLOADED" && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              Log de procesamiento
            </p>
            <div className="max-h-[180px] space-y-1 overflow-y-auto">
              {pipelineLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="shrink-0 text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span
                    className={
                      entry.status === "COMPLETED"
                        ? "text-green-600"
                        : entry.status === "FAILED"
                          ? "text-red-600"
                          : "text-foreground"
                    }
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
