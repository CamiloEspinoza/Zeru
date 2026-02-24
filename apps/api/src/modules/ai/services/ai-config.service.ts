import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { AiProvider } from '@prisma/client';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

@Injectable()
export class AiConfigService {
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    this.encryptionKey = Buffer.from(key.padEnd(64, '0').slice(0, 64), 'hex');
  }

  private encrypt(text: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decrypt(encryptedText: string): string {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey, iv);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
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
    return this.decrypt(config.encryptedApiKey);
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

    const encryptedApiKey = this.encrypt(data.apiKey);

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
}
