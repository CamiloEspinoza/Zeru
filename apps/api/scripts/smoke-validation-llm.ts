/* eslint-disable no-console */
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { z } from 'zod';
import { AppModule } from '../src/app.module';
import { ValidationLlmService } from '../src/modules/lab/validation/llm/validation-llm.service';

const TestSchema = z.object({
  verdict: z.enum(['PASS', 'FAIL']),
  reason: z.string().min(1),
});

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['warn', 'error'] });
  const svc = app.get(ValidationLlmService);
  const result = await svc.callStructured({
    feature: 'validation.smoke.f2_0',
    tenantId: process.env.SMOKE_TENANT_ID ?? 'd8d330f3-075d-41a5-9e6b-783d26f2070d',
    prompt:
      'You are a test validator. The user will give you a single sentence. ' +
      'Return verdict=PASS if the sentence contains a Chilean RUT in the form "12.345.678-K" (dots + dash); ' +
      'otherwise return verdict=FAIL. In either case, give a one-sentence reason.',
    userMessage: 'El paciente Juan Pérez, RUT 12.345.678-5, fue biopsiado el 01-04-2026.',
    schema: TestSchema,
    schemaName: 'RutPresenceVerdict',
  });
  console.log('--- result ---');
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
