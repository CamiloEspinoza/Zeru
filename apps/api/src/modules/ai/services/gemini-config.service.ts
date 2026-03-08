import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';

@Injectable()
export class GeminiConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getConfig(tenantId: string) {
    const config = await this.prisma.geminiConfig.findUnique({ where: { tenantId } });
    if (!config) return null;
    return {
      id: config.id,
      isActive: config.isActive,
      hasApiKey: !!config.encryptedApiKey,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getDecryptedApiKey(tenantId: string): Promise<string | null> {
    const config = await this.prisma.geminiConfig.findUnique({
      where: { tenantId },
      select: { encryptedApiKey: true, isActive: true },
    });
    if (!config || !config.isActive) return null;
    return this.encryption.decrypt(config.encryptedApiKey);
  }

  async upsert(tenantId: string, apiKey: string) {
    const encryptedApiKey = this.encryption.encrypt(apiKey);
    const config = await this.prisma.geminiConfig.upsert({
      where: { tenantId },
      update: { encryptedApiKey, isActive: true },
      create: { tenantId, encryptedApiKey, isActive: true },
    });
    return {
      id: config.id,
      isActive: config.isActive,
      hasApiKey: true,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async validateKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
      const res = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey,
      );
      if (res.ok) return { valid: true };
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      if (res.status === 400 || res.status === 403) return { valid: false, error: 'API key inválida o sin permisos' };
      return { valid: false, error: message };
    } catch {
      throw new BadRequestException('No se pudo conectar con Google. Verifica tu conexión.');
    }
  }

  async deleteKey(tenantId: string) {
    const config = await this.prisma.geminiConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('No hay configuración de Gemini para este tenant');
    await this.prisma.geminiConfig.delete({ where: { tenantId } });
  }
}
