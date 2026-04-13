export const DTE_EMISSION_QUEUE = 'dte-emission';
export const DTE_STATUS_CHECK_QUEUE = 'dte-status-check';
export const DTE_EXCHANGE_QUEUE = 'dte-exchange';
export const DTE_BULK_BOLETA_QUEUE = 'dte-bulk-boleta';
export const DTE_RCOF_QUEUE = 'dte-rcof';
export const DTE_RECEIVED_QUEUE = 'dte-received';

export const DTE_JOB_NAMES = {
  EMIT: 'dte.emit',
  CHECK_STATUS: 'dte.check-status',
  SEND_TO_RECEPTOR: 'dte.send-to-receptor',
  BULK_BOLETA: 'dte.bulk-boleta',
  GENERATE_RCOF: 'dte.generate-rcof',
  PROCESS_RECEIVED: 'dte.process-received',
} as const;

export const DTE_QUEUE_CONFIG = {
  EMISSION: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 3000 },
    concurrency: 5,
  },
  STATUS_CHECK: {
    attempts: 10,
    backoff: { type: 'exponential' as const, delay: 10000 },
    concurrency: 3,
  },
  EXCHANGE: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 5000 },
    concurrency: 3,
  },
  BULK_BOLETA: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    concurrency: 10,
  },
  RCOF: {
    attempts: 5,
    backoff: { type: 'exponential' as const, delay: 10000 },
    concurrency: 1,
  },
  RECEIVED: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    concurrency: 3,
  },
};
