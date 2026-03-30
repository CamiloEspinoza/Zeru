export const ORG_PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'] as const;
export type OrgProjectStatus = (typeof ORG_PROJECT_STATUSES)[number];

export const ORG_ENTITY_TYPES = [
  'ORGANIZATION', 'DEPARTMENT', 'ROLE', 'PROCESS', 'ACTIVITY',
  'SYSTEM', 'DOCUMENT_TYPE', 'PROBLEM', 'IMPROVEMENT',
] as const;
export type OrgEntityType = (typeof ORG_ENTITY_TYPES)[number];

export const ORG_RELATION_TYPES = [
  'BELONGS_TO', 'EXECUTES', 'OWNS', 'CONTAINS', 'DEPENDS_ON',
  'USES', 'PRECEDES', 'FOLLOWS', 'TRIGGERS', 'INPUTS', 'OUTPUTS',
] as const;
export type OrgRelationType = (typeof ORG_RELATION_TYPES)[number];

export const PROBLEM_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type ProblemSeverity = (typeof PROBLEM_SEVERITIES)[number];

export const PROCESSING_STATUSES = [
  'PENDING', 'UPLOADED', 'TRANSCRIBING', 'POST_PROCESSING',
  'EXTRACTING', 'RESOLVING_COREFERENCES', 'SUMMARIZING',
  'CHUNKING', 'EMBEDDING', 'COMPLETED', 'FAILED',
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

/** Descriptive messages shown to the user during each pipeline step */
export const PROCESSING_STATUS_MESSAGES: Record<ProcessingStatus, string> = {
  PENDING: 'Entrevista pendiente de procesamiento',
  UPLOADED: 'Audio recibido correctamente',
  TRANSCRIBING: 'Convirtiendo audio a texto con identificación de hablantes (Deepgram Nova-3)',
  POST_PROCESSING: 'Limpiando y estructurando la transcripción',
  EXTRACTING: 'Extrayendo roles, procesos, problemas y dependencias con IA (5 pasadas de análisis)',
  RESOLVING_COREFERENCES: 'Reconciliando entidades duplicadas y resolviendo co-referencias entre entrevistas',
  SUMMARIZING: 'Generando resúmenes de cada segmento de la entrevista',
  CHUNKING: 'Dividiendo la transcripción en fragmentos para búsqueda semántica',
  EMBEDDING: 'Generando embeddings vectoriales para búsqueda semántica',
  COMPLETED: 'Procesamiento finalizado exitosamente',
  FAILED: 'Error durante el procesamiento',
};

/** A single entry in the processingLog JSON array stored in the Interview model */
export interface PipelineLogEntry {
  status: ProcessingStatus;
  message: string;
  timestamp: string; // ISO 8601
}

/** SSE event emitted during interview pipeline processing */
export interface PipelineEvent {
  type: 'pipeline:status' | 'pipeline:progress';
  interviewId: string;
  status: ProcessingStatus;
  message: string;
  timestamp: string; // ISO 8601
}

export const ENTITY_TYPE_COLORS: Record<OrgEntityType, string> = {
  ORGANIZATION: 'slate',
  DEPARTMENT: 'blue',
  ROLE: 'indigo',
  PROCESS: 'emerald',
  ACTIVITY: 'teal',
  SYSTEM: 'amber',
  DOCUMENT_TYPE: 'orange',
  PROBLEM: 'red',
  IMPROVEMENT: 'green',
};
