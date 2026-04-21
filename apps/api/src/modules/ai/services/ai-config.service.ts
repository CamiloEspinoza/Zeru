import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { AiProvider } from '@prisma/client';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

@Injectable()
export class AiConfigService {
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
  ) {}

  getClientFor(provider: 'OPENAI' | 'ANTHROPIC'): OpenAI | Anthropic {
    if (provider === 'OPENAI') return this.getOpenAiClient();
    if (provider === 'ANTHROPIC') return this.getAnthropicClient();
    throw new Error(`Unsupported provider: ${provider}`);
  }

  private getOpenAiClient(): OpenAI {
    if (!this.openaiClient) {
      const apiKey = this.config.get<string>('OPENAI_API_KEY');
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
      }
      this.openaiClient = new OpenAI({ apiKey });
    }
    return this.openaiClient;
  }

  private getAnthropicClient(): Anthropic {
    if (!this.anthropicClient) {
      const apiKey = this.config.get<string>('ANTHROPIC_API_KEY');
      if (!apiKey) {
        throw new Error('ANTHROPIC_API_KEY is not set');
      }
      this.anthropicClient = new Anthropic({ apiKey });
    }
    return this.anthropicClient;
  }

  async getConfig(tenantId: string) {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { tenantId },
    });

    if (!config) return null;

    return {
      id: config.id,
      provider: config.provider,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      isActive: config.isActive,
      tenantId: config.tenantId,
      hasApiKey: !!config.encryptedApiKey,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getDecryptedApiKey(tenantId: string): Promise<string | null> {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { tenantId },
      select: { encryptedApiKey: true, isActive: true },
    });

    if (!config || !config.isActive) return null;
    return this.encryption.decrypt(config.encryptedApiKey);
  }

  async getFullConfig(tenantId: string) {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { tenantId },
    });
    return config;
  }

  async upsert(tenantId: string, data: { provider: AiProvider; apiKey: string; model: string; reasoningEffort?: string }) {
    const reasoningEffort = data.reasoningEffort ?? 'medium';

    // If KEEP_EXISTING sentinel, only update model/provider without changing the key
    if (data.apiKey === 'KEEP_EXISTING') {
      const existing = await this.prisma.aiProviderConfig.findUnique({ where: { tenantId } });
      if (!existing) {
        throw new Error('No hay configuración previa. Debes ingresar una API key.');
      }
      const config = await this.prisma.aiProviderConfig.update({
        where: { tenantId },
        data: { provider: data.provider, model: data.model, reasoningEffort, isActive: true },
      });
      return {
        id: config.id, provider: config.provider, model: config.model,
        reasoningEffort: config.reasoningEffort,
        isActive: config.isActive, tenantId: config.tenantId, hasApiKey: true,
        createdAt: config.createdAt, updatedAt: config.updatedAt,
      };
    }

    const encryptedApiKey = this.encryption.encrypt(data.apiKey);

    const config = await this.prisma.aiProviderConfig.upsert({
      where: { tenantId },
      update: {
        provider: data.provider,
        encryptedApiKey,
        model: data.model,
        reasoningEffort,
        isActive: true,
      },
      create: {
        tenantId,
        provider: data.provider,
        encryptedApiKey,
        model: data.model,
        reasoningEffort,
        isActive: true,
      },
    });

    return {
      id: config.id,
      provider: config.provider,
      model: config.model,
      reasoningEffort: config.reasoningEffort,
      isActive: config.isActive,
      tenantId: config.tenantId,
      hasApiKey: true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  /** Validates an API key by hitting the provider's lightest endpoint */
  async validateKey(provider: 'OPENAI', apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch('https://api.openai.com/v1/models?limit=1', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (res.ok) return { valid: true };

      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const message: string = body?.error?.message ?? `HTTP ${res.status}`;

      if (res.status === 401) return { valid: false, error: 'API key inválida o revocada' };
      if (res.status === 403) return { valid: false, error: 'Sin permisos para usar esta API key' };
      return { valid: false, error: message };
    } catch {
      throw new BadRequestException('No se pudo conectar con OpenAI. Verifica tu conexión.');
    }
  }

  async disable(tenantId: string) {
    const config = await this.prisma.aiProviderConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('Configuración de IA no encontrada');

    return this.prisma.aiProviderConfig.update({
      where: { tenantId },
      data: { isActive: false },
    });
  }

  async deleteKey(tenantId: string) {
    const config = await this.prisma.aiProviderConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('No hay configuración de IA para este tenant');

    await this.prisma.aiProviderConfig.delete({ where: { tenantId } });
  }
}
