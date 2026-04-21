import { Injectable, Logger } from '@nestjs/common';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';
import { AiConfigService } from '../../../ai/services/ai-config.service';
import { AiUsageService } from '../../../ai/services/ai-usage.service';
import type { StructuredLlmCall, StructuredLlmResult } from './types';

const DEFAULT_MODEL_OPENAI = 'gpt-5.4-mini';
const SCHEMA_VALIDATION_ERROR = 'schema validation failed';

@Injectable()
export class ValidationLlmService {
  private readonly logger = new Logger(ValidationLlmService.name);

  constructor(
    private readonly aiConfig: AiConfigService,
    private readonly aiUsage: AiUsageService,
  ) {}

  async callStructured<T extends z.ZodTypeAny>(
    call: StructuredLlmCall<T>,
  ): Promise<StructuredLlmResult<z.infer<T>>> {
    const provider = call.provider ?? 'OPENAI';
    if (provider !== 'OPENAI') {
      throw new Error(
        `ValidationLlmService: provider ${provider} not yet implemented in F2.0. ` +
          `Anthropic support ships with the concordance agent in F2.1.`,
      );
    }
    return this.callOpenAi(call);
  }

  private async callOpenAi<T extends z.ZodTypeAny>(
    call: StructuredLlmCall<T>,
  ): Promise<StructuredLlmResult<z.infer<T>>> {
    const client = this.aiConfig.getClientFor('OPENAI');
    const model = call.model ?? DEFAULT_MODEL_OPENAI;

    let lastParseError: unknown;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const started = Date.now();
      const response = await (client as unknown as {
        responses: {
          parse: (args: unknown) => Promise<{
            output_parsed: unknown;
            output_text?: string;
            usage?: { input_tokens?: number; output_tokens?: number };
          }>;
        };
      }).responses.parse({
        model,
        input: call.userMessage
          ? [
              { role: 'system', content: call.prompt },
              { role: 'user', content: call.userMessage },
            ]
          : call.prompt,
        text: { format: zodTextFormat(call.schema, call.schemaName) },
        temperature: call.temperature ?? 0,
      });

      const durationMs = Date.now() - started;
      const completedAt = new Date();
      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      // Log usage on every attempt — we want to pay for retries too so the
      // cost dashboard reflects reality.
      await this.aiUsage.logUsage({
        provider: 'OPENAI',
        model,
        feature: call.feature,
        tenantId: call.tenantId,
        inputTokens,
        outputTokens,
        durationMs,
        completedAt,
      });

      const parsed = call.schema.safeParse(response.output_parsed);
      if (parsed.success) {
        return {
          data: parsed.data,
          provider: 'OPENAI',
          model,
          inputTokens,
          outputTokens,
          durationMs,
          completedAt,
        };
      }

      lastParseError = parsed.error;
      this.logger.warn(
        `[${call.feature}] schema validation failed on attempt ${attempt}: ${parsed.error.message}`,
      );
      // On attempt 1, loop retries. On attempt 2, fall through to throw.
    }

    throw new Error(
      `${SCHEMA_VALIDATION_ERROR} after 2 attempts: ${
        (lastParseError as { message?: string })?.message ?? 'unknown'
      }`,
    );
  }
}
