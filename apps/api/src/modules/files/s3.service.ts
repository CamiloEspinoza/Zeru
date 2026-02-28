import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageConfigService, type DecryptedStorageConfig } from '../storage-config/storage-config.service';

@Injectable()
export class S3Service {
  constructor(private readonly storageConfigService: StorageConfigService) {}

  private async getContext(tenantId: string): Promise<{ client: S3Client; bucket: string }> {
    const config = await this.storageConfigService.getDecryptedConfig(tenantId);
    if (!config) {
      throw new BadRequestException(
        'Configura tus credenciales de almacenamiento en Ajustes → Almacenamiento',
      );
    }

    const client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });

    return { client, bucket: config.bucket };
  }

  /**
   * Uploads a buffer to S3.
   * Key format: tenants/{tenantId}/documents/{uuid}/{filename}
   */
  async upload(tenantId: string, key: string, buffer: Buffer, mimeType: string): Promise<void> {
    const { client, bucket } = await this.getContext(tenantId);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error uploading file to S3: ${(err as Error).message}`,
      );
    } finally {
      client.destroy();
    }
  }

  /**
   * Returns a presigned GET URL valid for the given duration.
   */
  async getPresignedUrl(tenantId: string, key: string, expiresIn = 3600): Promise<string> {
    const { client, bucket } = await this.getContext(tenantId);
    try {
      return await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn },
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error generating presigned URL: ${(err as Error).message}`,
      );
    } finally {
      client.destroy();
    }
  }

  /** Deletes an object from S3. */
  async delete(tenantId: string, key: string): Promise<void> {
    const { client, bucket } = await this.getContext(tenantId);
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error deleting file from S3: ${(err as Error).message}`,
      );
    } finally {
      client.destroy();
    }
  }

  /** Builds the S3 key for a document. */
  static buildKey(tenantId: string, docId: string, filename: string): string {
    return `tenants/${tenantId}/documents/${docId}/${filename}`;
  }
}
