import { Test } from '@nestjs/testing';
import { AgentRunnerService } from './agent-runner.service';
import { ConsolidatorService } from './consolidator.service';
import { IdentityAgent } from '../agents/identity.agent';
import { OriginAgent } from '../agents/origin.agent';
import { TraceabilityAgent } from '../agents/traceability.agent';
import { PrismaService } from '../../../../prisma/prisma.service';
import type { AgentRunResult } from '../agents/types';
import type { ExtractedExam } from '../../../filemaker/transformers/types';

function makeExam(): ExtractedExam {
  return {
    fmInformeNumber: 12345,
    fmSource: 'BIOPSIAS',
    fmRecordId: 'r1',
    subjectFirstName: 'A',
    subjectPaternalLastName: 'B',
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
    validatedAt: new Date(),
    issuedAt: new Date(),
    signers: [],
    attachmentRefs: [],
  };
}

describe('AgentRunnerService', () => {
  let runner: AgentRunnerService;
  let agentRunCreate: jest.Mock;
  let findingCreate: jest.Mock;
  let validationUpdate: jest.Mock;
  let identityRun: jest.Mock;
  let originRun: jest.Mock;
  let traceabilityRun: jest.Mock;

  beforeEach(async () => {
    agentRunCreate = jest.fn().mockResolvedValue({ id: 'run-1' });
    findingCreate = jest.fn().mockResolvedValue({ id: 'finding-1' });
    validationUpdate = jest.fn().mockResolvedValue({ id: 'val-1' });

    identityRun = jest.fn().mockResolvedValue({
      agentKey: 'IDENTITY',
      verdict: 'PASS',
      confidence: 1,
      findings: [],
      durationMs: 5,
    } satisfies AgentRunResult);
    originRun = jest.fn().mockResolvedValue({
      agentKey: 'ORIGIN',
      verdict: 'PASS',
      confidence: 1,
      findings: [],
      durationMs: 5,
    } satisfies AgentRunResult);
    traceabilityRun = jest.fn().mockResolvedValue({
      agentKey: 'TRACEABILITY',
      verdict: 'PASS',
      confidence: 1,
      findings: [],
      durationMs: 5,
    } satisfies AgentRunResult);

    const module = await Test.createTestingModule({
      providers: [
        AgentRunnerService,
        ConsolidatorService,
        { provide: IdentityAgent, useValue: { key: 'IDENTITY', run: identityRun } },
        { provide: OriginAgent, useValue: { key: 'ORIGIN', run: originRun } },
        { provide: TraceabilityAgent, useValue: { key: 'TRACEABILITY', run: traceabilityRun } },
        {
          provide: PrismaService,
          useValue: {
            labValidationAgentRun: { create: agentRunCreate },
            labValidationFinding: { create: findingCreate },
            labReportValidation: { update: validationUpdate },
          },
        },
      ],
    }).compile();

    runner = module.get(AgentRunnerService);
  });

  it('runs all 3 agents and persists each run', async () => {
    await runner.runAll({
      tenantId: 't1',
      validationId: 'v1',
      diagnosticReportId: 'dr1',
      exam: makeExam(),
    });
    expect(identityRun).toHaveBeenCalledTimes(1);
    expect(originRun).toHaveBeenCalledTimes(1);
    expect(traceabilityRun).toHaveBeenCalledTimes(1);
    expect(agentRunCreate).toHaveBeenCalledTimes(3);
  });

  it('updates LabReportValidation with final verdict (PASS → GREEN)', async () => {
    await runner.runAll({
      tenantId: 't1',
      validationId: 'v1',
      diagnosticReportId: 'dr1',
      exam: makeExam(),
    });
    // First update: ANALYZING. Last update: COMPLETED with mapped verdict.
    expect(validationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          verdict: 'GREEN',
          isCritical: false,
        }),
      }),
    );
  });

  it('maps an UNCERTAIN agent (thrown error) to YELLOW verdict', async () => {
    identityRun.mockRejectedValue(new Error('boom'));
    await runner.runAll({
      tenantId: 't1',
      validationId: 'v1',
      diagnosticReportId: 'dr1',
      exam: makeExam(),
    });
    // Identity threw → UNCERTAIN; others PASS → consolidated UNCERTAIN → YELLOW.
    expect(validationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          verdict: 'YELLOW',
        }),
      }),
    );
    // The IDENTITY agent run should be persisted with WARN verdict.
    expect(agentRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentKey: 'IDENTITY',
          verdict: 'WARN',
        }),
      }),
    );
  });
});
