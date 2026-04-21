import { Test } from '@nestjs/testing';
import { ValidationSyncedListener } from './validation-synced.listener';
import { AgentRunnerService } from '../services/agent-runner.service';

describe('ValidationSyncedListener', () => {
  let listener: ValidationSyncedListener;
  let runAll: jest.Mock;

  beforeEach(async () => {
    runAll = jest.fn().mockResolvedValue({ verdict: 'PASS' });
    const module = await Test.createTestingModule({
      providers: [
        ValidationSyncedListener,
        { provide: AgentRunnerService, useValue: { runAll } },
      ],
    }).compile();
    listener = module.get(ValidationSyncedListener);
  });

  it('forwards event payload to AgentRunnerService.runAll', async () => {
    const payload = {
      validationId: 'v1',
      tenantId: 't1',
      diagnosticReportId: 'dr1',
      serviceRequestId: 'sr1',
      fmSource: 'BIOPSIAS',
      fmInformeNumber: 42,
      exam: {} as never,
      pdfBuffer: null,
    };
    await listener.handle(payload);
    expect(runAll).toHaveBeenCalledWith({
      tenantId: 't1',
      validationId: 'v1',
      diagnosticReportId: 'dr1',
      exam: payload.exam,
    });
  });

  it('does not throw when runner throws (event handler isolation)', async () => {
    runAll.mockRejectedValue(new Error('boom'));
    await expect(
      listener.handle({
        validationId: 'v1',
        tenantId: 't1',
        diagnosticReportId: 'dr1',
        serviceRequestId: 'sr1',
        fmSource: 'BIOPSIAS',
        fmInformeNumber: 42,
        exam: {} as never,
        pdfBuffer: null,
      }),
    ).resolves.not.toThrow();
  });
});
