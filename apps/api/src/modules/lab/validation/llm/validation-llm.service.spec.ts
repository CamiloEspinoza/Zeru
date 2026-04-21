import { Test } from '@nestjs/testing';
import { z } from 'zod';
import { ValidationLlmService } from './validation-llm.service';
import { AiConfigService } from '../../../ai/services/ai-config.service';
import { AiUsageService } from '../../../ai/services/ai-usage.service';

const schema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  reason: z.string(),
});

describe('ValidationLlmService.callStructured (OpenAI)', () => {
  let service: ValidationLlmService;
  let responsesParse: jest.Mock;
  let logUsage: jest.Mock;

  beforeEach(async () => {
    responsesParse = jest.fn();
    logUsage = jest.fn().mockResolvedValue({ id: 'log-1' });
    const fakeOpenAiClient = { responses: { parse: responsesParse } };
    const module = await Test.createTestingModule({
      providers: [
        ValidationLlmService,
        {
          provide: AiConfigService,
          useValue: { getClientFor: (p: string) => (p === 'OPENAI' ? fakeOpenAiClient : undefined) },
        },
        { provide: AiUsageService, useValue: { logUsage } },
      ],
    }).compile();
    service = module.get(ValidationLlmService);
  });

  it('parses output, returns typed data, logs usage with durationMs', async () => {
    responsesParse.mockResolvedValueOnce({
      output_parsed: { verdict: 'PASS', reason: 'ok' },
      usage: { input_tokens: 150, output_tokens: 20 },
    });
    const before = Date.now();
    const result = await service.callStructured({
      feature: 'validation.test',
      tenantId: 't1',
      prompt: 'body',
      schema,
      schemaName: 'TestVerdict',
    });
    expect(result.data).toEqual({ verdict: 'PASS', reason: 'ok' });
    expect(result.provider).toBe('OPENAI');
    expect(result.inputTokens).toBe(150);
    expect(result.outputTokens).toBe(20);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(logUsage).toHaveBeenCalledTimes(1);
    const logged = logUsage.mock.calls[0][0];
    expect(logged.provider).toBe('OPENAI');
    expect(logged.feature).toBe('validation.test');
    expect(logged.durationMs).toBeGreaterThanOrEqual(0);
    expect(logged.completedAt).toBeInstanceOf(Date);
  });

  it('retries once when the first response does not match the schema', async () => {
    responsesParse
      .mockResolvedValueOnce({
        output_parsed: null,
        output_text: '{ "verdict": "MAYBE" }', // not in enum
        usage: { input_tokens: 100, output_tokens: 10 },
      })
      .mockResolvedValueOnce({
        output_parsed: { verdict: 'FAIL', reason: 'retry ok' },
        usage: { input_tokens: 110, output_tokens: 15 },
      });
    const result = await service.callStructured({
      feature: 'validation.test',
      tenantId: 't1',
      prompt: 'body',
      schema,
      schemaName: 'TestVerdict',
    });
    expect(responsesParse).toHaveBeenCalledTimes(2);
    expect(result.data.verdict).toBe('FAIL');
    expect(logUsage).toHaveBeenCalledTimes(2); // one per attempt
  });

  it('throws after two parse failures (no infinite retries)', async () => {
    responsesParse.mockResolvedValue({
      output_parsed: null,
      output_text: '{ "verdict": "NOPE" }',
      usage: { input_tokens: 100, output_tokens: 10 },
    });
    await expect(
      service.callStructured({
        feature: 'validation.test',
        tenantId: 't1',
        prompt: 'body',
        schema,
        schemaName: 'TestVerdict',
      }),
    ).rejects.toThrow(/schema validation failed/i);
    expect(responsesParse).toHaveBeenCalledTimes(2);
  });

  it('propagates provider errors without logging usage', async () => {
    responsesParse.mockRejectedValue(new Error('rate_limited'));
    await expect(
      service.callStructured({
        feature: 'validation.test',
        tenantId: 't1',
        prompt: 'body',
        schema,
        schemaName: 'TestVerdict',
      }),
    ).rejects.toThrow(/rate_limited/);
    expect(logUsage).not.toHaveBeenCalled();
  });
});
