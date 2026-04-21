import { Test } from '@nestjs/testing';
import { AiConfigService } from './ai-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { ConfigService } from '@nestjs/config';

describe('AiConfigService — provider support', () => {
  let service: AiConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AiConfigService,
        { provide: PrismaService, useValue: {} },
        { provide: EncryptionService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => {
              if (k === 'OPENAI_API_KEY') return 'sk-openai-fake';
              if (k === 'ANTHROPIC_API_KEY') return 'sk-ant-fake';
              return undefined;
            },
          },
        },
      ],
    }).compile();
    service = module.get(AiConfigService);
  });

  it('returns an OpenAI client for provider=OPENAI', () => {
    const client = service.getClientFor('OPENAI');
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('OpenAI');
  });

  it('returns an Anthropic client for provider=ANTHROPIC', () => {
    const client = service.getClientFor('ANTHROPIC');
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('Anthropic');
  });

  it('throws on unknown provider', () => {
    // @ts-expect-error — probing runtime guard
    expect(() => service.getClientFor('GEMINI')).toThrow(/unsupported provider/i);
  });

  it('throws with the variable name when the API key env var is missing', async () => {
    const moduleNoKey = await Test.createTestingModule({
      providers: [
        AiConfigService,
        { provide: PrismaService, useValue: {} },
        { provide: EncryptionService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    }).compile();
    const svc = moduleNoKey.get(AiConfigService);
    expect(() => svc.getClientFor('OPENAI')).toThrow('OPENAI_API_KEY is not set');
    expect(() => svc.getClientFor('ANTHROPIC')).toThrow('ANTHROPIC_API_KEY is not set');
  });
});
