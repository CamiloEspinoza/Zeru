import { TraceabilityAgent } from './traceability.agent';
import type { AgentRunInput } from './types';
import type {
  ExtractedAttachmentRef,
  ExtractedExam,
  ExtractedSigner,
} from '../../../filemaker/transformers/types';

function makeSigner(overrides: Partial<ExtractedSigner> = {}): ExtractedSigner {
  return {
    codeSnapshot: 'PAT-001',
    nameSnapshot: 'Dr. Pérez',
    role: 'PRIMARY_PATHOLOGIST',
    signatureOrder: 1,
    signedAt: new Date('2026-03-15'),
    isActive: true,
    supersededBy: null,
    correctionReason: null,
    ...overrides,
  };
}

function makePdfRef(): ExtractedAttachmentRef {
  return {
    category: 'REPORT_PDF',
    label: 'Informe 12345',
    sequenceOrder: 0,
    s3Key: 'Biopsias/PROC-001/2026/03/12345.pdf',
    contentType: 'application/pdf',
    fmSourceField: 'INFORMES PDF::PDF INFORME',
    fmContainerUrlOriginal: 'https://fm.example/.../12345.pdf',
    citolabS3KeyOriginal: null,
  };
}

function makeExam(overrides: Partial<ExtractedExam> = {}): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'rec-1',
    subjectFirstName: 'Juan',
    subjectPaternalLastName: 'Pérez',
    subjectMaternalLastName: null,
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
    sampleCollectedAt: new Date('2026-03-10'),
    receivedAt: null,
    requestedAt: new Date('2026-03-10'),
    status: 'VALIDATED',
    conclusion: null,
    fullText: null,
    microscopicDescription: null,
    macroscopicDescription: null,
    isAlteredOrCritical: false,
    validatedAt: new Date('2026-03-15'),
    issuedAt: new Date('2026-03-15'),
    signers: [makeSigner()],
    attachmentRefs: [makePdfRef()],
    ...overrides,
  };
}

function makeInput(exam: ExtractedExam): AgentRunInput {
  return { tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam };
}

describe('TraceabilityAgent', () => {
  const agent = new TraceabilityAgent();

  it('PASS for a complete BIOPSIA with signer + dates + PDF', async () => {
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
  });

  it('FAIL when signers list is empty (V032)', async () => {
    const result = await agent.run(makeInput(makeExam({ signers: [] })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V032')).toBe(true);
  });

  it('FAIL when signer order has gaps (V033)', async () => {
    const result = await agent.run(
      makeInput(
        makeExam({
          signers: [
            makeSigner({ signatureOrder: 1 }),
            makeSigner({ signatureOrder: 3, codeSnapshot: 'PAT-002', nameSnapshot: 'Dr. B' }),
          ],
        }),
      ),
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V033')).toBe(true);
  });

  it('FAIL when no PRIMARY_PATHOLOGIST in BIOPSY (V034)', async () => {
    const result = await agent.run(
      makeInput(
        makeExam({
          signers: [makeSigner({ role: 'SUPERVISING_PATHOLOGIST' })],
        }),
      ),
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V034')).toBe(true);
  });

  it('FAIL when validatedAt is null but status=VALIDATED (V038)', async () => {
    const result = await agent.run(makeInput(makeExam({ validatedAt: null })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V038')).toBe(true);
  });

  it('FAIL when validatedAt is before requestedAt (V039)', async () => {
    const result = await agent.run(
      makeInput(
        makeExam({
          requestedAt: new Date('2026-03-20'),
          validatedAt: new Date('2026-03-15'),
        }),
      ),
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V039')).toBe(true);
  });

  it('FAIL when issuedAt is before validatedAt (V041)', async () => {
    const result = await agent.run(
      makeInput(
        makeExam({
          validatedAt: new Date('2026-03-15'),
          issuedAt: new Date('2026-03-10'),
        }),
      ),
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V041')).toBe(true);
  });

  it('FAIL when status=DELIVERED but no PDF attachment ref (V042)', async () => {
    const result = await agent.run(
      makeInput(
        makeExam({
          status: 'DELIVERED',
          attachmentRefs: [],
        }),
      ),
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V042')).toBe(true);
  });
});
