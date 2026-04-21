import type { ExtractedExam } from '../../../filemaker/transformers/types';

/**
 * Input compartido por todos los agentes de validación.
 * Todo el contexto necesario para evaluar el caso, sin acceso a Prisma —
 * los agentes son funciones puras (no efectos secundarios).
 */
export interface AgentRunInput {
  tenantId: string;
  validationId: string;
  diagnosticReportId: string;
  exam: ExtractedExam;
}

/**
 * Verdict de un agente individual sobre el caso.
 * - PASS: todas las validaciones cubiertas pasaron.
 * - FAIL: al menos una validación crítica falló (severidad la marca el agente).
 * - UNCERTAIN: no se pudo evaluar (datos faltantes, dependencia externa caída).
 */
export type AgentVerdict = 'PASS' | 'FAIL' | 'UNCERTAIN';

/** Severidad de un finding individual. Define el peso en el consolidador. */
export type FindingSeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Hallazgo atómico encontrado por un agente. Persiste 1:1 en
 * LabValidationFinding.
 */
export interface AgentFinding {
  /** Código de la validación (ej: 'V001', 'RI-04'). */
  code: string;
  /** Severidad del hallazgo. */
  severity: FindingSeverity;
  /** Mensaje legible para el operador. */
  message: string;
  /** Referencias opcionales al field FM o al fragmento de texto que lo originó. */
  evidence?: Record<string, unknown>;
}

export interface AgentRunResult {
  /** Identificador del agente (debe matchear ValidationAgentKey en Prisma). */
  agentKey: 'IDENTITY' | 'ORIGIN' | 'TRACEABILITY';
  verdict: AgentVerdict;
  /** Confianza 0-1 (1 = determinístico, sin dudas). */
  confidence: number;
  /** Findings individuales que generaron el verdict. */
  findings: AgentFinding[];
  /** Duración en ms del run (medida por el caller). */
  durationMs: number;
  /** Mensaje de error si verdict=UNCERTAIN. */
  errorMessage?: string;
}

/**
 * Contrato común a todos los agentes (determinísticos y LLM en F2+).
 */
export interface ValidationAgent {
  readonly key: AgentRunResult['agentKey'];
  run(input: AgentRunInput): Promise<AgentRunResult>;
}
