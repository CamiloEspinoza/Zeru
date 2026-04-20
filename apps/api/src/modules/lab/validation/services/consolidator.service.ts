import { Injectable } from '@nestjs/common';
import type { AgentRunResult, AgentVerdict } from '../agents/types';

export interface ConsolidatedVerdict {
  verdict: AgentVerdict;
  confidenceAvg: number;
  isCritical: boolean;
  isAcuteCritical: boolean;
  totalFindings: number;
}

@Injectable()
export class ConsolidatorService {
  consolidate(runs: AgentRunResult[]): ConsolidatedVerdict {
    const totalFindings = runs.reduce((sum, r) => sum + r.findings.length, 0);
    const confidenceAvg =
      runs.length === 0
        ? 0
        : runs.reduce((sum, r) => sum + r.confidence, 0) / runs.length;

    const hasCritical = runs.some((r) =>
      r.findings.some((f) => f.severity === 'CRITICAL'),
    );
    const hasFail = runs.some((r) => r.verdict === 'FAIL');
    const hasUncertain = runs.some((r) => r.verdict === 'UNCERTAIN');

    let verdict: AgentVerdict;
    if (hasFail) {
      verdict = 'FAIL';
    } else if (hasUncertain) {
      verdict = 'UNCERTAIN';
    } else {
      verdict = 'PASS';
    }

    return {
      verdict,
      confidenceAvg,
      isCritical: hasCritical,
      isAcuteCritical: false, // F2 calcula este flag con criticality agent
      totalFindings,
    };
  }
}
