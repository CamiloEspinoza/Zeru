import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';
import { AiProvider } from '@prisma/client';

@Injectable()
export class AiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getConfig(tenantId: string) {
    const config = await this.prisma.aiProviderConfig.findUnique({
      where: { tenantId },
    });

    if (!config) return null;

    return {
      id: config.id,
      provider: config.provider,
      model: config.model,
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

  async upsert(tenantId: string, data: { provider: AiProvider; apiKey: string; model: string }) {
    // If KEEP_EXISTING sentinel, only update model/provider without changing the key
    if (data.apiKey === 'KEEP_EXISTING') {
      const existing = await this.prisma.aiProviderConfig.findUnique({ where: { tenantId } });
      if (!existing) {
        throw new Error('No hay configuración previa. Debes ingresar una API key.');
      }
      const config = await this.prisma.aiProviderConfig.update({
        where: { tenantId },
        data: { provider: data.provider, model: data.model, isActive: true },
      });
      return {
        id: config.id, provider: config.provider, model: config.model,
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
        isActive: true,
      },
      create: {
        tenantId,
        provider: data.provider,
        encryptedApiKey,
        model: data.model,
        isActive: true,
      },
    });

    return {
      id: config.id,
      provider: config.provider,
      model: config.model,
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
    if (!config) throw new NotFoundException('Configuracion de IA no encontrada');

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
