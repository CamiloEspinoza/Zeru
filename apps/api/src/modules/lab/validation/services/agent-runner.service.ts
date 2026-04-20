import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { IdentityAgent } from '../agents/identity.agent';
import { OriginAgent } from '../agents/origin.agent';
import { TraceabilityAgent } from '../agents/traceability.agent';
import type {
  AgentRunInput,
  AgentRunResult,
  AgentVerdict,
  FindingSeverity,
  ValidationAgent,
} from '../agents/types';
import {
  ConsolidatorService,
  type ConsolidatedVerdict,
} from './consolidator.service';

const AGENT_TIMEOUT_MS = 30_000;

/** FindingSeverity in agents/types includes INFO, but the Prisma enum
 * `FindingSeverity` only has CRITICAL|HIGH|MEDIUM|LOW. Map INFO → LOW. */
type PrismaFindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/** Prisma `FindingVerdict` enum values. */
type PrismaFindingVerdict = 'PASS' | 'WARN' | 'FAIL';

/** Prisma `ValidationVerdict` enum values. */
type PrismaValidationVerdict = 'GREEN' | 'YELLOW' | 'RED' | 'PENDING';

@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);
  private readonly agents: ValidationAgent[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly consolidator: ConsolidatorService,
    identity: IdentityAgent,
    origin: OriginAgent,
    traceability: TraceabilityAgent,
  ) {
    this.agents = [identity, origin, traceability];
  }

  /**
   * Ejecuta los 3 agentes en paralelo, persiste runs+findings,
   * actualiza LabReportValidation a COMPLETED con verdict.
   */
  async runAll(input: AgentRunInput): Promise<ConsolidatedVerdict> {
    this.logger.log(
      `[Validation ${input.validationId}] running ${this.agents.length} agents`,
    );

    // Marcar como ANALYZING al iniciar.
    await this.prisma.labReportValidation.update({
      where: { id: input.validationId },
      data: { status: 'ANALYZING', analysisStartedAt: new Date() },
    });

    const results = await Promise.all(
      this.agents.map((agent) => this.runOne(agent, input)),
    );

    // Persistir cada run + sus findings.
    for (const result of results) {
      const run = await this.prisma.labValidationAgentRun.create({
        data: {
          validationId: input.validationId,
          agentKey: result.agentKey,
          verdict: mapAgentVerdictToFindingVerdict(result.verdict),
          severity: highestSeverity(result),
          confidence: result.confidence,
          durationMs: result.durationMs,
          model: null,
          provider: null,
        },
      });
      for (const finding of result.findings) {
        await this.prisma.labValidationFinding.create({
          data: {
            validationId: input.validationId,
            agentKey: result.agentKey,
            ruleId: finding.code,
            verdict: severityToFindingVerdict(finding.severity),
            severity: mapSeverityToPrisma(finding.severity),
            message: finding.message,
            evidenceQuote:
              finding.evidence !== undefined
                ? JSON.stringify(finding.evidence)
                : null,
            evidenceSource: `agent:${result.agentKey}:${run.id}`,
          },
        });
      }
    }

    const consolidated = this.consolidator.consolidate(results);

    await this.prisma.labReportValidation.update({
      where: { id: input.validationId },
      data: {
        status: 'COMPLETED',
        verdict: mapAgentVerdictToValidationVerdict(consolidated.verdict),
        confidenceAvg: consolidated.confidenceAvg,
        isCritical: consolidated.isCritical,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `[Validation ${input.validationId}] ${consolidated.verdict} ` +
        `(${consolidated.totalFindings} findings, conf=${consolidated.confidenceAvg.toFixed(2)})`,
    );

    return consolidated;
  }

  /** Ejecuta un agente con timeout. Si falla o excede timeout → UNCERTAIN. */
  private async runOne(
    agent: ValidationAgent,
    input: AgentRunInput,
  ): Promise<AgentRunResult> {
    const start = Date.now();
    let timeoutHandle: NodeJS.Timeout | undefined;
    try {
      const result = await Promise.race<AgentRunResult>([
        agent.run(input),
        new Promise<AgentRunResult>((_, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error(`agent ${agent.key} timeout`)),
            AGENT_TIMEOUT_MS,
          );
        }),
      ]);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[Validation ${input.validationId}] agent ${agent.key} failed: ${msg}`,
      );
      return {
        agentKey: agent.key,
        verdict: 'UNCERTAIN',
        confidence: 0,
        findings: [],
        durationMs: Date.now() - start,
        errorMessage: msg,
      };
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }
  }
}

function mapAgentVerdictToFindingVerdict(
  v: AgentVerdict,
): PrismaFindingVerdict {
  switch (v) {
    case 'PASS':
      return 'PASS';
    case 'FAIL':
      return 'FAIL';
    case 'UNCERTAIN':
      return 'WARN';
  }
}

function mapAgentVerdictToValidationVerdict(
  v: AgentVerdict,
): PrismaValidationVerdict {
  switch (v) {
    case 'PASS':
      return 'GREEN';
    case 'FAIL':
      return 'RED';
    case 'UNCERTAIN':
      return 'YELLOW';
  }
}

function mapSeverityToPrisma(s: FindingSeverity): PrismaFindingSeverity {
  // Prisma enum lacks INFO — colapsamos a LOW.
  return s === 'INFO' ? 'LOW' : s;
}

/**
 * Severidad de un finding individual mapeada a verdict.
 * INFO/LOW → PASS, MEDIUM → WARN, HIGH/CRITICAL → FAIL.
 */
function severityToFindingVerdict(s: FindingSeverity): PrismaFindingVerdict {
  switch (s) {
    case 'INFO':
    case 'LOW':
      return 'PASS';
    case 'MEDIUM':
      return 'WARN';
    case 'HIGH':
    case 'CRITICAL':
      return 'FAIL';
  }
}

function highestSeverity(r: AgentRunResult): PrismaFindingSeverity {
  const order: Record<PrismaFindingSeverity, number> = {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  let acc: PrismaFindingSeverity = 'LOW';
  for (const f of r.findings) {
    const mapped = mapSeverityToPrisma(f.severity);
    if (order[mapped] > order[acc]) acc = mapped;
  }
  return acc;
}
