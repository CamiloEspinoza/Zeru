import { Test } from '@nestjs/testing';
import { OriginAgent } from './origin.agent';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentRunInput } from './types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

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
  return { tenantId: 't1', validationId: 'v1', diagnosticReportId: 'dr1', exam };
}

describe('OriginAgent', () => {
  let agent: OriginAgent;
  let labOriginFindFirst: jest.Mock;
  let sensitiveFindMany: jest.Mock;

  beforeEach(async () => {
    labOriginFindFirst = jest.fn();
    sensitiveFindMany = jest.fn().mockResolvedValue([]);

    const module = await Test.createTestingModule({
      providers: [
        OriginAgent,
        {
          provide: PrismaService,
          useValue: {
            labOrigin: { findFirst: labOriginFindFirst },
            labSensitiveOrigin: { findMany: sensitiveFindMany },
          },
        },
      ],
    }).compile();

    agent = module.get(OriginAgent);
  });

  it('PASS when origin exists and is not sensitive', async () => {
    labOriginFindFirst.mockResolvedValue({ id: 'orig-1', name: 'Hospital X' });
    const result = await agent.run(makeInput(makeExam()));
    expect(result.verdict).toBe('PASS');
    expect(result.findings).toHaveLength(0);
  });

  it('FAIL when labOriginCode is empty (V009)', async () => {
    const result = await agent.run(makeInput(makeExam({ labOriginCode: '' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V009')).toBe(true);
  });

  it('FAIL when labOrigin does not exist in tenant (V010)', async () => {
    labOriginFindFirst.mockResolvedValue(null);
    const result = await agent.run(makeInput(makeExam({ labOriginCode: 'GHOST-999' })));
    expect(result.verdict).toBe('FAIL');
    expect(result.findings.some((f) => f.code === 'V010')).toBe(true);
  });

  it('flags as sensitive when origin name matches sensitive lexicon (V014)', async () => {
    labOriginFindFirst.mockResolvedValue({ id: 'orig-1', name: 'HTSP Cardiología' });
    sensitiveFindMany.mockResolvedValue([{ id: 'sens-1', nameMatch: 'HTSP' }]);
    const result = await agent.run(makeInput(makeExam()));
    // Sensible no es FAIL: es flag para criticality agent (F2). Aquí registramos INFO.
    expect(result.verdict).toBe('PASS');
    expect(result.findings.some((f) => f.code === 'V014' && f.severity === 'INFO')).toBe(true);
  });
});
