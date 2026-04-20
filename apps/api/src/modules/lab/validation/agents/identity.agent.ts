import { Injectable } from '@nestjs/common';
import type { AgentFinding, AgentRunInput, AgentRunResult, ValidationAgent } from './types';

@Injectable()
export class IdentityAgent implements ValidationAgent {
  readonly key = 'IDENTITY' as const;

  async run(input: AgentRunInput): Promise<AgentRunResult> {
    const start = Date.now();
    const { exam } = input;
    const findings: AgentFinding[] = [];
    let uncertain = false;

    // V007: nombre y paterno requeridos.
    if (!exam.subjectFirstName?.trim()) {
      findings.push({
        code: 'V007',
        severity: 'CRITICAL',
        message: 'subjectFirstName is empty',
      });
    }
    if (!exam.subjectPaternalLastName?.trim()) {
      findings.push({
        code: 'V007',
        severity: 'CRITICAL',
        message: 'subjectPaternalLastName is empty',
      });
    }

    // V008: si el paciente tiene edad declarada, debe haber RUT.
    if ((exam.subjectAge ?? 0) > 0 && !exam.subjectRut) {
      findings.push({
        code: 'V008',
        severity: 'CRITICAL',
        message: 'subjectAge > 0 but subjectRut is missing',
      });
    }

    // V001: validar DV chileno si hay RUT.
    if (exam.subjectRut && !isValidChileanRut(exam.subjectRut)) {
      findings.push({
        code: 'V001',
        severity: 'CRITICAL',
        message: `Invalid Chilean RUT check digit: ${exam.subjectRut}`,
        evidence: { rut: exam.subjectRut },
      });
    }

    // V006: edad no verificable sin fecha de nacimiento ni edad.
    if (exam.subjectAge == null && exam.subjectBirthDate == null) {
      findings.push({
        code: 'V006',
        severity: 'MEDIUM',
        message: 'cannot verify age coherence — neither subjectAge nor subjectBirthDate present',
      });
      uncertain = true;
    }

    // RI-04: maternal opcional, pero si existe debe ser string no vacío
    // (no es FAIL — solo INFO).
    if (exam.subjectMaternalLastName === '') {
      findings.push({
        code: 'RI-04',
        severity: 'LOW',
        message: 'maternalLastName is empty string (expected null)',
      });
    }

    // RI-05: gender válido si presente.
    if (exam.subjectGender !== null && exam.subjectGender !== undefined) {
      const valid = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'];
      if (!valid.includes(exam.subjectGender)) {
        findings.push({
          code: 'RI-05',
          severity: 'MEDIUM',
          message: `unexpected gender value: ${exam.subjectGender}`,
        });
      }
    }

    const verdict: AgentRunResult['verdict'] = uncertain
      ? 'UNCERTAIN'
      : findings.some((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH')
        ? 'FAIL'
        : 'PASS';

    return {
      agentKey: 'IDENTITY',
      verdict,
      confidence: 1,
      findings,
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Valida RUT chileno (módulo 11). Asume normalización previa
 * (sin puntos ni guión, K mayúscula).
 */
function isValidChileanRut(rut: string): boolean {
  // Real Chilean RUTs have 7-8 digits in the body. Accepting shorter inputs
  // masks upstream extraction bugs and defeats V001's purpose.
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return false;
  const body = rut.slice(0, -1);
  const dv = rut.slice(-1);
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const r = 11 - (sum % 11);
  const expected = r === 11 ? '0' : r === 10 ? 'K' : String(r);
  return dv === expected;
}
