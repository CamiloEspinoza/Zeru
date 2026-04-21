import { Injectable } from '@nestjs/common';
import type { DiagnosticReportStatusType } from '../../../filemaker/transformers/types';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

const VALIDATED_STATUSES: ReadonlyArray<DiagnosticReportStatusType> = [
  'VALIDATED',
  'SIGNED',
  'DELIVERED',
  'DOWNLOADED',
];

const PDF_S3_KEY_REGEX = /^[A-Za-z]+\/[^/]+\/\d{4}\/\d{2}\/\d+\.pdf$/;

@Injectable()
export class TraceabilityAgent implements ValidationAgent {
  readonly key = 'TRACEABILITY' as const;

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { exam } = input;
    const findings: AgentFinding[] = [];

    // V032: al menos un signer en estados validados.
    if (VALIDATED_STATUSES.includes(exam.status) && exam.signers.length === 0) {
      findings.push({
        code: 'V032',
        severity: 'CRITICAL',
        message: `status=${exam.status} but signers list is empty`,
      });
    }

    // V033: signatureOrder secuencial 1..N sin huecos.
    if (exam.signers.length > 0) {
      const orders = [...exam.signers].map((s) => s.signatureOrder).sort((a, b) => a - b);
      for (let i = 0; i < orders.length; i++) {
        if (orders[i] !== i + 1) {
          findings.push({
            code: 'V033',
            severity: 'HIGH',
            message: `signer order has gap or duplicate: expected ${i + 1}, got ${orders[i]}`,
            evidence: { orders },
          });
          break;
        }
      }
    }

    // V034: BIOPSY requiere al menos un PRIMARY_PATHOLOGIST activo.
    if (exam.category === 'BIOPSY' && VALIDATED_STATUSES.includes(exam.status)) {
      const hasPrimary = exam.signers.some(
        (s) => s.role === 'PRIMARY_PATHOLOGIST' && s.isActive,
      );
      if (!hasPrimary) {
        findings.push({
          code: 'V034',
          severity: 'CRITICAL',
          message: 'BIOPSY validated without active PRIMARY_PATHOLOGIST signer',
        });
      }
    }

    // V038: validatedAt requerido si status indica validación o más adelante.
    if (VALIDATED_STATUSES.includes(exam.status) && !exam.validatedAt) {
      findings.push({
        code: 'V038',
        severity: 'CRITICAL',
        message: `status=${exam.status} but validatedAt is null`,
      });
    }

    // V039: validatedAt >= requestedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.requestedAt &&
      exam.validatedAt.getTime() < exam.requestedAt.getTime()
    ) {
      findings.push({
        code: 'V039',
        severity: 'HIGH',
        message: 'validatedAt is earlier than requestedAt',
        evidence: { requestedAt: exam.requestedAt, validatedAt: exam.validatedAt },
      });
    }

    // V040: validatedAt >= sampleCollectedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.sampleCollectedAt &&
      exam.validatedAt.getTime() < exam.sampleCollectedAt.getTime()
    ) {
      findings.push({
        code: 'V040',
        severity: 'HIGH',
        message: 'validatedAt is earlier than sampleCollectedAt',
      });
    }

    // V041: issuedAt >= validatedAt (si ambos presentes).
    if (
      exam.validatedAt &&
      exam.issuedAt &&
      exam.issuedAt.getTime() < exam.validatedAt.getTime()
    ) {
      findings.push({
        code: 'V041',
        severity: 'HIGH',
        message: 'issuedAt is earlier than validatedAt',
      });
    }

    // V042: status DELIVERED/DOWNLOADED requiere ref de PDF.
    if (exam.status === 'DELIVERED' || exam.status === 'DOWNLOADED') {
      const hasPdf = exam.attachmentRefs.some((a) => a.category === 'REPORT_PDF');
      if (!hasPdf) {
        findings.push({
          code: 'V042',
          severity: 'HIGH',
          message: `status=${exam.status} but no REPORT_PDF attachment ref`,
        });
      }
    }

    // V043: s3Key del PDF debe seguir formato {Categoria}/{origen}/{año}/{mes}/{informe}.pdf
    const pdf = exam.attachmentRefs.find((a) => a.category === 'REPORT_PDF');
    if (pdf && !PDF_S3_KEY_REGEX.test(pdf.s3Key)) {
      findings.push({
        code: 'V043',
        severity: 'MEDIUM',
        message: `unexpected s3Key format: ${pdf.s3Key}`,
        evidence: { s3Key: pdf.s3Key },
      });
    }

    const verdict = findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
      ? 'FAIL'
      : 'PASS';

    return {
      agentKey: 'TRACEABILITY',
      verdict,
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}
