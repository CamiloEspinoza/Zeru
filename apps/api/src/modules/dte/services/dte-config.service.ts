import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaClient } from '@prisma/client';
import { CreateDteConfigSchema } from '@zeru/shared';
import { EncryptionService } from '../../../common/services/encryption.service';

@Injectable()
export class DteConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async get(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const config = await db.dteConfig.findUnique({ where: { tenantId } });
    if (!config) {
      throw new NotFoundException(
        'Configuración DTE no encontrada. Configure los datos del emisor primero.',
      );
    }
    // Decrypt encryptedImapPass for internal use, but mask it in API responses
    if (config.encryptedImapPass) {
      config.encryptedImapPass = this.encryption.decrypt(
        config.encryptedImapPass,
      );
    }
    return config;
  }

  async getOptional(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const config = await db.dteConfig.findUnique({ where: { tenantId } });
    if (!config) return null;
    // Decrypt encryptedImapPass for internal use
    if (config.encryptedImapPass) {
      config.encryptedImapPass = this.encryption.decrypt(
        config.encryptedImapPass,
      );
    }
    return config;
  }

  /**
   * Returns config safe for API responses (encryptedImapPass masked).
   */
  async getForApi(tenantId: string) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;
    const config = await db.dteConfig.findUnique({ where: { tenantId } });
    if (!config) {
      throw new NotFoundException(
        'Configuración DTE no encontrada. Configure los datos del emisor primero.',
      );
    }
    return {
      ...config,
      encryptedImapPass: config.encryptedImapPass ? '***' : null,
    };
  }

  async upsert(tenantId: string, data: CreateDteConfigSchema) {
    const db = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Encrypt encryptedImapPass before saving if provided (accepts `imapPass`
    // from the client and stores it encrypted into `encryptedImapPass`).
    const processedData = { ...data } as Record<string, unknown>;
    if (
      'imapPass' in processedData &&
      processedData.imapPass &&
      typeof processedData.imapPass === 'string'
    ) {
      processedData.encryptedImapPass = this.encryption.encrypt(
        processedData.imapPass as string,
      );
      delete processedData.imapPass;
    }

    await db.dteConfig.upsert({
      where: { tenantId },
      create: {
        ...processedData,
        resolutionDate: new Date(data.resolutionDate),
        tenantId,
      } as any,
      update: {
        ...processedData,
        resolutionDate: new Date(data.resolutionDate),
      } as any,
    });

    return this.getForApi(tenantId);
  }
}
