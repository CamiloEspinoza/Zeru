import { IdentityAgent } from './identity.agent';
import type { AgentRunInput } from './types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

function makeExam(overrides: Partial<ExtractedExam> = {}): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'rec-1',
    subjectFirstName: 'Juan',
    subjectPaternalLastName: 'Pérez',
    subjectMaternalLastName: 'Soto',
    subjectRut: '123456785',
    subjectAge: 65,
    subjectGender: 'MALE',
    category: 'BIOPSY',
    subcategory: null,
    isUrgent: false,
    requestingPhysicianName: null,
    labOriginCode: 'PROC-001',
    anatomicalSite: null,
    clinicalHistory: null,
    sampleCollectedAt: null,
    receivedAt: null,
    requestedAt: null,
    status: 'VALIDATED',
    conclusion: null,
    fullText: null,
    microscopicDescription: null,
    macroscopicDescription: null,
    isAlteredOrCritical: false,
    validatedAt: null,
    issuedAt: null,
    signers: [],
    attachmentRefs: [],
    ...overrides,
  };
}

function makeInput(exam: ExtractedExam): AgentRunInput {
  return {
    tenantId: 't1',
    validationId: 'v1',
    diagnosticReportId: 'dr1',
    exam,
  };
}

describe('IdentityAgent', () => {
  const agent = new IdentityAgent();

  it('PASS when all identity fields are present and valid', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
    expect(result.confidence).toBe(1);
    expect(result.agentKey).toBe('IDENTITY');
  });

  it('FAIL when subjectRut has invalid check digit (V001)', async () => {
    // 12.345.678-0 → DV correcto es 5; 0 es inválido
    const result = await agent.run(makeInput(makeExam({ subjectRut: '123456780' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V001')).toBe(true);
  });

  it('FAIL when subjectRut is null but subjectAge > 0 (V008)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectRut: null })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V008')).toBe(true);
  });

  it('FAIL when subjectFirstName is empty (V007)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectFirstName: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V007')).toBe(true);
  });

  it('FAIL when paternalLastName is empty (V007)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectPaternalLastName: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V007')).toBe(true);
  });

  it('UNCERTAIN when subjectAge is null (cannot verify V006)', async () => {
    const result = await agent.run(makeInput(makeExam({ subjectAge: null })));
    expect(result.verdict).toBe('UNCERTAIN');
    expect(result.findings.some((f) => f.code === 'V006')).toBe(true);
  });

  it('records durationMs and confidence', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
