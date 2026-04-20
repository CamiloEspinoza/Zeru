import { ConsolidatorService } from './consolidator.service';
import type { AgentRunResult } from '../agents/types';

function passResult(agentKey: AgentRunResult['agentKey']): AgentRunResult {
  return { agentKey, verdict: 'PASS', confidence: 1, findings: [], durationMs: 5 };
}

function failResult(
  agentKey: AgentRunResult['agentKey'],
  severity: 'CRITICAL' | 'HIGH' = 'CRITICAL',
): AgentRunResult {
  return {
    agentKey,
    verdict: 'FAIL',
    confidence: 1,
    findings: [{ code: 'X', severity, message: 'failed' }],
    durationMs: 5,
  };
}

function uncertainResult(agentKey: AgentRunResult['agentKey']): AgentRunResult {
  return {
    agentKey,
    verdict: 'UNCERTAIN',
    confidence: 0.5,
    findings: [{ code: 'V006', severity: 'MEDIUM', message: 'unknown' }],
    durationMs: 5,
  };
}

describe('ConsolidatorService', () => {
  const consolidator = new ConsolidatorService();

  it('PASS when all agents PASS', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      passResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('PASS');
    expect(result.confidenceAvg).toBe(1);
    expect(result.isCritical).toBe(false);
  });

  it('FAIL when any agent has CRITICAL finding', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      failResult('ORIGIN', 'CRITICAL'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('FAIL');
    expect(result.isCritical).toBe(true);
  });

  it('FAIL when only HIGH findings (no CRITICAL)', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      failResult('TRACEABILITY', 'HIGH'),
      passResult('ORIGIN'),
    ]);
    expect(result.verdict).toBe('FAIL');
    expect(result.isCritical).toBe(false);
  });

  it('UNCERTAIN when one agent UNCERTAIN and rest PASS', () => {
    const result = consolidator.consolidate([
      uncertainResult('IDENTITY'),
      passResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('UNCERTAIN');
  });

  it('FAIL takes precedence over UNCERTAIN', () => {
    const result = consolidator.consolidate([
      uncertainResult('IDENTITY'),
      failResult('ORIGIN', 'CRITICAL'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.verdict).toBe('FAIL');
  });

  it('confidenceAvg averages confidence across agents', () => {
    const result = consolidator.consolidate([
      passResult('IDENTITY'),
      uncertainResult('ORIGIN'),
      passResult('TRACEABILITY'),
    ]);
    expect(result.confidenceAvg).toBeCloseTo((1 + 0.5 + 1) / 3, 4);
  });
});
