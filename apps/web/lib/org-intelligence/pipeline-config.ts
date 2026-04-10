export const pipelineSteps = [
  "UPLOADED",
  "TRANSCRIBING",
  "POST_PROCESSING",
  "EXTRACTING",
  "RESOLVING_COREFERENCES",
  "SUMMARIZING",
  "CHUNKING",
  "EMBEDDING",
  "COMPLETED",
];

export const pipelineStepLabels: Record<string, string> = {
  UPLOADED: "Subido",
  TRANSCRIBING: "Transcribiendo",
  POST_PROCESSING: "Post-procesando",
  EXTRACTING: "Extrayendo",
  RESOLVING_COREFERENCES: "Reconciliando",
  SUMMARIZING: "Resumiendo",
  CHUNKING: "Fragmentando",
  EMBEDDING: "Indexando",
  COMPLETED: "Completado",
};

export const pipelineStepDescriptions: Record<string, string> = {
  UPLOADED: "Audio recibido correctamente",
  TRANSCRIBING:
    "Convirtiendo audio a texto con identificación de hablantes (Deepgram Nova-3)",
  POST_PROCESSING: "Limpiando y estructurando la transcripción",
  EXTRACTING:
    "Extrayendo roles, procesos, problemas y dependencias con IA (5 pasadas de análisis)",
  RESOLVING_COREFERENCES:
    "Reconciliando entidades duplicadas y resolviendo co-referencias entre entrevistas",
  SUMMARIZING: "Generando resúmenes de cada segmento de la entrevista",
  CHUNKING:
    "Dividiendo la transcripción en fragmentos para búsqueda semántica",
  EMBEDDING: "Generando embeddings vectoriales para búsqueda semántica",
  COMPLETED:
    "Procesamiento finalizado. Los resultados están disponibles en las pestañas de Análisis y Diagnóstico del proyecto.",
};

const speakerColors = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
  "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
  "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200",
];

export function getSpeakerColor(
  speaker: string,
  speakerMap: Map<string, number>,
): string {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, speakerMap.size);
  }
  const index = speakerMap.get(speaker)!;
  return speakerColors[index % speakerColors.length];
}
