import { Injectable, NotFoundException } from '@nestjs/common';
import { SESClient, GetAccountCommand } from '@aws-sdk/client-ses';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

export interface DecryptedEmailConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
}

@Injectable()
export class EmailConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getConfig(tenantId: string) {
    const config = await this.prisma.emailConfig.findUnique({
      where: { tenantId },
    });

    if (!config) return null;

    return {
      id: config.id,
      region: config.region,
      isActive: config.isActive,
      hasCredentials: !!config.encryptedAccessKeyId,
      fromEmail: this.encryption.decrypt(config.encryptedFromEmail),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getDecryptedConfig(tenantId: string): Promise<DecryptedEmailConfig | null> {
    const config = await this.prisma.emailConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) return null;

    return {
      region: config.region,
      accessKeyId: this.encryption.decrypt(config.encryptedAccessKeyId),
      secretAccessKey: this.encryption.decrypt(config.encryptedSecretKey),
      fromEmail: this.encryption.decrypt(config.encryptedFromEmail),
    };
  }

  /**
   * Busca la configuración de email para cualquier tenant al que pertenezca el email dado.
   * Se usa para el flujo de login (sin tenant context).
   */
  async findConfigForEmail(email: string): Promise<DecryptedEmailConfig | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            tenant: {
              include: { emailConfig: true },
            },
          },
        },
      },
    });

    if (!user) return null;

    for (const membership of user.memberships) {
      const cfg = membership.tenant.emailConfig;
      if (cfg?.isActive) {
        return {
          region: cfg.region,
          accessKeyId: this.encryption.decrypt(cfg.encryptedAccessKeyId),
          secretAccessKey: this.encryption.decrypt(cfg.encryptedSecretKey),
          fromEmail: this.encryption.decrypt(cfg.encryptedFromEmail),
        };
      }
    }

    return null;
  }

  async upsert(tenantId: string, data: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
  }) {
    const encryptedAccessKeyId = this.encryption.encrypt(data.accessKeyId);
    const encryptedSecretKey = this.encryption.encrypt(data.secretAccessKey);
    const encryptedFromEmail = this.encryption.encrypt(data.fromEmail);

    const config = await this.prisma.emailConfig.upsert({
      where: { tenantId },
      update: {
        region: data.region,
        encryptedAccessKeyId,
        encryptedSecretKey,
        encryptedFromEmail,
        isActive: true,
      },
      create: {
        tenantId,
        region: data.region,
        encryptedAccessKeyId,
        encryptedSecretKey,
        encryptedFromEmail,
        isActive: true,
      },
    });

    return {
      id: config.id,
      region: config.region,
      isActive: config.isActive,
      hasCredentials: true,
      fromEmail: data.fromEmail,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async validateCredentials(data: {
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    fromEmail: string;
  }): Promise<{ valid: boolean; error?: string }> {
    const client = new SESClient({
      region: data.region,
      credentials: {
        accessKeyId: data.accessKeyId,
        secretAccessKey: data.secretAccessKey,
      },
    });

    try {
      await client.send(new GetAccountCommand({}));
      return { valid: true };
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      const status = error.$metadata?.httpStatusCode;

      if (status === 403) return { valid: false, error: 'Sin permisos SES. Verifica las credenciales y que la cuenta tenga acceso a SES.' };
      if (status === 400) return { valid: false, error: 'Credenciales inválidas o región incorrecta.' };

      return { valid: false, error: `Error al verificar: ${(err as Error).message}` };
    } finally {
      client.destroy();
    }
  }

  async deleteConfig(tenantId: string) {
    const config = await this.prisma.emailConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('No hay configuración de email para este tenant');

    await this.prisma.emailConfig.delete({ where: { tenantId } });
  }
}
