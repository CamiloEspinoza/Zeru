import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class PlatformStorageService {
  private readonly logger = new Logger(PlatformStorageService.name);
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.getOrThrow<string>('PLATFORM_S3_BUCKET');
    this.region = this.config.getOrThrow<string>('PLATFORM_S3_REGION');
    this.accessKeyId = this.config.getOrThrow<string>('PLATFORM_S3_ACCESS_KEY_ID');
    this.secretAccessKey = this.config.getOrThrow<string>('PLATFORM_S3_SECRET_ACCESS_KEY');
  }

  private createClient(): S3Client {
    return new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const client = this.createClient();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );
      this.logger.log(`Uploaded: ${key}`);
      return key;
    } catch (error) {
      this.logger.error(`Upload failed: ${key}`, error);
      throw new InternalServerErrorException('Error al subir archivo');
    } finally {
      client.destroy();
    }
  }

  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const client = this.createClient();
    try {
      return await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (error) {
      this.logger.error(`Presigned URL failed: ${key}`, error);
      throw new InternalServerErrorException('Error al generar URL');
    } finally {
      client.destroy();
    }
  }

  async delete(key: string): Promise<void> {
    const client = this.createClient();
    try {
      await client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.log(`Deleted: ${key}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${key}`, error);
      throw new InternalServerErrorException('Error al eliminar archivo');
    } finally {
      client.destroy();
    }
  }

  static buildBrandingKey(tenantId: string, type: 'logo' | 'isotipo' | 'favicon', filename: string): string {
    return `platform/tenants/${tenantId}/branding/${type}/${filename}`;
  }
}
