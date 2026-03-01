import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';

export interface DecryptedStorageConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

@Injectable()
export class StorageConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getConfig(tenantId: string) {
    const config = await this.prisma.storageConfig.findUnique({
      where: { tenantId },
    });

    if (!config) return null;

    return {
      id: config.id,
      region: config.region,
      isActive: config.isActive,
      hasCredentials: !!config.encryptedAccessKeyId,
      bucket: this.encryption.decrypt(config.encryptedBucket),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async getDecryptedConfig(tenantId: string): Promise<DecryptedStorageConfig | null> {
    const config = await this.prisma.storageConfig.findUnique({
      where: { tenantId },
    });

    if (!config || !config.isActive) return null;

    return {
      region: config.region,
      accessKeyId: this.encryption.decrypt(config.encryptedAccessKeyId),
      secretAccessKey: this.encryption.decrypt(config.encryptedSecretKey),
      bucket: this.encryption.decrypt(config.encryptedBucket),
    };
  }

  async upsert(tenantId: string, data: {
    region: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    bucket: string;
  }) {
    let accessKeyId = data.accessKeyId?.trim() || '';
    let secretAccessKey = data.secretAccessKey?.trim() || '';

    // Fallback to stored credentials when not provided
    if (!accessKeyId || !secretAccessKey) {
      const stored = await this.getDecryptedConfig(tenantId);
      if (!stored && (!accessKeyId || !secretAccessKey)) {
        throw new BadRequestException('Se requieren Access Key ID y Secret Access Key.');
      }
      accessKeyId = accessKeyId || stored!.accessKeyId;
      secretAccessKey = secretAccessKey || stored!.secretAccessKey;
    }

    const encryptedAccessKeyId = this.encryption.encrypt(accessKeyId);
    const encryptedSecretKey = this.encryption.encrypt(secretAccessKey);
    const encryptedBucket = this.encryption.encrypt(data.bucket);

    const config = await this.prisma.storageConfig.upsert({
      where: { tenantId },
      update: {
        region: data.region,
        encryptedAccessKeyId,
        encryptedSecretKey,
        encryptedBucket,
        isActive: true,
      },
      create: {
        tenantId,
        region: data.region,
        encryptedAccessKeyId,
        encryptedSecretKey,
        encryptedBucket,
        isActive: true,
      },
    });

    return {
      id: config.id,
      region: config.region,
      isActive: config.isActive,
      hasCredentials: true,
      bucket: data.bucket,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async validateCredentials(
    tenantId: string,
    data: {
      region: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      bucket: string;
    },
  ): Promise<{ valid: boolean; error?: string }> {
    let accessKeyId = data.accessKeyId?.trim() || '';
    let secretAccessKey = data.secretAccessKey?.trim() || '';

    // Fallback to stored credentials when not provided
    if (!accessKeyId || !secretAccessKey) {
      const stored = await this.getDecryptedConfig(tenantId);
      if (!stored) {
        return { valid: false, error: 'No hay credenciales configuradas. Ingresa Access Key ID y Secret Access Key.' };
      }
      accessKeyId = accessKeyId || stored.accessKeyId;
      secretAccessKey = secretAccessKey || stored.secretAccessKey;
    }

    const client = new S3Client({
      region: data.region,
      credentials: { accessKeyId, secretAccessKey },
    });

    try {
      await client.send(new HeadBucketCommand({ Bucket: data.bucket }));
      return { valid: true };
    } catch (err: unknown) {
      const error = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      const status = error.$metadata?.httpStatusCode;

      if (status === 403) return { valid: false, error: 'Sin permisos para acceder al bucket. Verifica las credenciales.' };
      if (status === 404 || error.name === 'NotFound') return { valid: false, error: 'El bucket no existe en la región especificada.' };
      if (status === 301) return { valid: false, error: 'El bucket existe en otra región. Verifica la región seleccionada.' };

      return { valid: false, error: `Error al verificar: ${(err as Error).message}` };
    } finally {
      client.destroy();
    }
  }

  async deleteConfig(tenantId: string) {
    const config = await this.prisma.storageConfig.findUnique({ where: { tenantId } });
    if (!config) throw new NotFoundException('No hay configuración de almacenamiento para este tenant');

    await this.prisma.storageConfig.delete({ where: { tenantId } });
  }
}
