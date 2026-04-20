// ── BullMQ queue configuration for lab import pipeline ──

export const LAB_IMPORT_QUEUE = 'lab-import';
export const ATTACHMENT_MIGRATION_QUEUE = 'attachment-migration';
export const REPORT_VALIDATION_QUEUE = 'report-validation';

export const REPORT_VALIDATION_JOB_NAMES = {
  PROCESS_VALIDATION: 'process-validation',
} as const;

export const REPORT_VALIDATION_QUEUE_CONFIG = {
  concurrency: 5,
  retryAttempts: 3,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 3000, // 3s → 6s → 12s
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 3000 },
    removeOnComplete: { age: 86400, count: 1000 },
    removeOnFail: { age: 604800 },
  },
};

// ── Job names ──

export const JOB_NAMES = {
  EXAMS_BATCH: 'exams-batch',
  WORKFLOW_EVENTS_BATCH: 'workflow-events-batch',
  COMMUNICATIONS_BATCH: 'communications-batch',
  LIQUIDATIONS: 'liquidations',
  CHARGES_BATCH: 'charges-batch',
  ATTACHMENT_DOWNLOAD: 'attachment-download',
  PHASE_COMPLETE: 'phase-complete',
} as const;

// ── Phase identifiers (execution order) ──

export const PHASES = {
  EXAMS: 'phase-1-exams',
  WORKFLOW_COMMS: 'phase-2-workflow-comms',
  LIQUIDATIONS: 'phase-3-liquidations',
  CHARGES: 'phase-4-charges',
  ATTACHMENTS: 'phase-5-attachments',
} as const;

// ── Configuration ──

export const IMPORT_QUEUE_CONFIG = {
  concurrency: 20,
  defaultBatchSize: 100,
  retryAttempts: 5,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 5000, // 5s initial → 10s → 20s → 40s → 80s
  },
};

export const ATTACHMENT_QUEUE_CONFIG = {
  concurrency: 10,
  retryAttempts: 10,
  retryBackoff: {
    type: 'exponential' as const,
    delay: 3000,
  },
  rateLimiter: {
    max: 50, // 50 jobs
    duration: 1000, // per 1 second
  },
};

// ── FM source processing order ──
// BIOPSIAS first (primary), BIOPSIASRESPALDO second (delta only)
// PAPANICOLAOU first (primary), PAPANICOLAOUHISTORICO second (delta only)
export const SOURCE_ORDER: readonly string[] = [
  'BIOPSIAS',
  'BIOPSIASRESPALDO',
  'PAPANICOLAOU',
  'PAPANICOLAOUHISTORICO',
];
