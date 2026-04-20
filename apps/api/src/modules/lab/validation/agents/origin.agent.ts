import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

@Injectable()
export class OriginAgent implements ValidationAgent {
  readonly key = 'ORIGIN' as const;

  constructor(private readonly prisma: PrismaService) {}

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { tenantId, exam } = input;
    const findings: AgentFinding[] = [];

    // V009: labOriginCode no vacío.
    if (!exam.labOriginCode || !exam.labOriginCode.trim()) {
      findings.push({
        code: 'V009',
        severity: 'CRITICAL',
        message: 'labOriginCode is empty in FM record',
      });
      // Sin código no podemos chequear V010/V014 — terminamos.
      return {
        agentKey: 'ORIGIN',
        verdict: 'FAIL',
        confidence: 1,
        findings,
        durationMs: Date.now() - start,
      };
    }

    // V010: el código existe en la tabla LabOrigin del tenant.
    const origin = await this.prisma.labOrigin.findFirst({
      where: { tenantId, code: exam.labOriginCode },
      select: { id: true, name: true },
    });

    if (!origin) {
      findings.push({
        code: 'V010',
        severity: 'CRITICAL',
        message: `labOriginCode ${exam.labOriginCode} not found in tenant origins`,
        evidence: { labOriginCode: exam.labOriginCode },
      });
      return {
        agentKey: 'ORIGIN',
        verdict: 'FAIL',
        confidence: 1,
        findings,
        durationMs: Date.now() - start,
      };
    }

    // V014: si el nombre del origin matchea LabSensitiveOrigin → flag INFO
    // (criticality agent en F2 lo eleva a CRITICAL si corresponde).
    // Cargamos toda la lista del tenant — son pocos rows (≤20 esperado para
    // Citolab) y el match es por substring case-insensitive en aplicación,
    // no expresable como índice Postgres.
    const sensitiveList = await this.prisma.labSensitiveOrigin.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, nameMatch: true },
    });
    const matchedSensitive = sensitiveList.find((s) =>
      origin.name.toUpperCase().includes(s.nameMatch.toUpperCase()),
    );
    if (matchedSensitive) {
      findings.push({
        code: 'V014',
        severity: 'INFO',
        message: `origin matches sensitive pattern "${matchedSensitive.nameMatch}"`,
        evidence: { sensitiveId: matchedSensitive.id, originName: origin.name },
      });
    }

    return {
      agentKey: 'ORIGIN',
      verdict: 'PASS',
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}
