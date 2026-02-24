import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.client = new S3Client({
      region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID') ?? '',
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY') ?? '',
      },
    });
    this.bucket = this.config.get<string>('AWS_S3_BUCKET') ?? '';
  }

  /**
   * Uploads a buffer to S3.
   * Key format: tenants/{tenantId}/documents/{uuid}/{filename}
   */
  async upload(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
        }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error uploading file to S3: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Returns a presigned GET URL valid for the given duration.
   */
  async getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn },
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error generating presigned URL: ${(err as Error).message}`,
      );
    }
  }

  /** Deletes an object from S3. */
  async delete(key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (err) {
      throw new InternalServerErrorException(
        `Error deleting file from S3: ${(err as Error).message}`,
      );
    }
  }

  /** Builds the S3 key for a document. */
  static buildKey(tenantId: string, docId: string, filename: string): string {
    return `tenants/${tenantId}/documents/${docId}/${filename}`;
  }
}
