import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { FmApiService } from '../../filemaker/services/fm-api.service';
import { ATTACHMENT_MIGRATION_QUEUE } from '../constants/queue.constants';

export interface AttachmentJobData {
  runId: string;
  tenantId: string;
  attachmentId: string;
  targetS3Key: string;
  fmContainerUrl: string | null;
  citolabS3Key: string | null;
}

export interface CitolabS3Config {
  bucket: string;
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

@Processor(ATTACHMENT_MIGRATION_QUEUE)
export class AttachmentDownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(AttachmentDownloadProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly fmApi: FmApiService,
    @Inject('CITOLAB_S3_CONFIG')
    private readonly citolabConfig: CitolabS3Config,
  ) {
    super();
  }

  async process(job: Job<AttachmentJobData>): Promise<void> {
    const { attachmentId, tenantId, targetS3Key, fmContainerUrl, citolabS3Key } = job.data;

    const attachment = await this.prisma.labDiagnosticReportAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.migrationStatus === 'UPLOADED') return;

    // Mark as downloading
    await this.prisma.labDiagnosticReportAttachment.update({
      where: { id: attachmentId },
      data: {
        migrationStatus: 'DOWNLOADING',
        migrationAttempts: { increment: 1 },
      },
    });

    try {
      let fileBuffer: Buffer;
      let contentType: string;

      if (citolabS3Key) {
        // Download from Citolab S3
        const result = await this.downloadFromCitolabS3(citolabS3Key);
        fileBuffer = result.buffer;
        contentType = result.contentType;
      } else if (fmContainerUrl) {
        // Download from FM container via streaming URL
        const result = await this.downloadFromFmContainer(fmContainerUrl);
        fileBuffer = result.buffer;
        contentType = result.contentType;
      } else {
        // No source available — skip
        await this.prisma.labDiagnosticReportAttachment.update({
          where: { id: attachmentId },
          data: { migrationStatus: 'SKIPPED', migrationError: 'No source URL available' },
        });
        return;
      }

      // Upload to Zeru S3
      await this.s3Service.upload(tenantId, targetS3Key, fileBuffer, contentType);

      // Update attachment record
      await this.prisma.labDiagnosticReportAttachment.update({
        where: { id: attachmentId },
        data: {
          migrationStatus: 'UPLOADED',
          migratedAt: new Date(),
          sizeBytes: fileBuffer.length,
          migrationError: null,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Attachment ${attachmentId} download failed: ${msg}`);

      await this.prisma.labDiagnosticReportAttachment.update({
        where: { id: attachmentId },
        data: {
          migrationStatus: 'FAILED_MIGRATION',
          migrationError: msg,
        },
      });

      throw error; // Let BullMQ retry
    }
  }

  /** Download a file from the Citolab S3 bucket using dedicated credentials. */
  async downloadFromCitolabS3(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const client = new S3Client({
      region: this.citolabConfig.region,
      ...(this.citolabConfig.accessKeyId && this.citolabConfig.secretAccessKey
        ? {
            credentials: {
              accessKeyId: this.citolabConfig.accessKeyId,
              secretAccessKey: this.citolabConfig.secretAccessKey,
            },
          }
        : {}),
    });

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.citolabConfig.bucket,
          Key: key,
        }),
      );

      const chunks: Buffer[] = [];
      for await (const chunk of response.Body as AsyncIterable<Buffer>) {
        chunks.push(chunk);
      }

      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType ?? 'application/octet-stream',
      };
    } finally {
      client.destroy();
    }
  }

  /** Download a file from an FM container streaming URL. */
  async downloadFromFmContainer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
    // FM container URLs are streaming URLs (Streaming_SSL)
    // They require authentication — use the FM API's auth token
    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`FM container download failed: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type') ?? 'application/octet-stream',
    };
  }
}
