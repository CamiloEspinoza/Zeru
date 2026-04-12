import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3Service } from '../../files/s3.service';
import { USER_SUMMARY_SELECT, mapUserWithAvatar } from '../../users/user-select';

@Injectable()
export class TaskAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  private buildKey(
    tenantId: string,
    taskId: string,
    uuid: string,
    filename: string,
  ): string {
    return `tenants/${tenantId}/tasks/${taskId}/attachments/${uuid}/${filename}`;
  }

  async upload(
    tenantId: string,
    taskId: string,
    userId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Verify task exists
    const task = await client.task.findFirst({
      where: { id: taskId, deletedAt: null },
    });
    if (!task) {
      throw new NotFoundException(`Tarea con id ${taskId} no encontrada`);
    }

    const attachmentId = randomUUID();
    const s3Key = this.buildKey(tenantId, taskId, attachmentId, file.originalname);

    await this.s3.upload(tenantId, s3Key, file.buffer, file.mimetype);

    const attachment = await client.taskAttachment.create({
      data: {
        id: attachmentId,
        name: file.originalname,
        s3Key,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        taskId,
        uploadedById: userId,
        tenantId,
      },
      include: {
        uploadedBy: { select: USER_SUMMARY_SELECT },
      },
    });

    // Generate a presigned URL for immediate use
    const url = await this.s3.getPresignedUrl(tenantId, s3Key, 3600);

    return {
      id: attachment.id,
      name: attachment.name,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      url,
      uploadedBy: mapUserWithAvatar(attachment.uploadedBy),
      createdAt: attachment.createdAt,
    };
  }

  async findAll(tenantId: string, taskId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const attachments = await client.taskAttachment.findMany({
      where: { taskId, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: USER_SUMMARY_SELECT },
      },
    });

    // Generate presigned URLs for all
    const results = await Promise.all(
      attachments.map(async (a) => {
        const url = await this.s3.getPresignedUrl(tenantId, a.s3Key, 3600);
        return {
          id: a.id,
          name: a.name,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          url,
          uploadedBy: mapUserWithAvatar(a.uploadedBy),
          createdAt: a.createdAt,
        };
      }),
    );

    return results;
  }

  async remove(tenantId: string, attachmentId: string, userId: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const attachment = await client.taskAttachment.findFirst({
      where: { id: attachmentId, tenantId },
    });
    if (!attachment) {
      throw new NotFoundException('Archivo adjunto no encontrado');
    }
    if (attachment.uploadedById !== userId) {
      throw new ForbiddenException(
        'Solo quien subió el archivo puede eliminarlo',
      );
    }

    await this.s3.delete(tenantId, attachment.s3Key);
    await client.taskAttachment.delete({ where: { id: attachmentId } });

    return { message: 'Archivo eliminado' };
  }

  /**
   * Upload an inline image (not attached to task record, just S3).
   * Returns a presigned URL for embedding in rich text.
   */
  async uploadInlineImage(
    tenantId: string,
    userId: string,
    file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  ) {
    const uuid = randomUUID();
    const ext = file.originalname.split('.').pop() ?? 'png';
    const s3Key = `tenants/${tenantId}/uploads/${uuid}.${ext}`;

    await this.s3.upload(tenantId, s3Key, file.buffer, file.mimetype);

    const url = await this.s3.getPresignedUrl(tenantId, s3Key, 86400); // 24h

    return { url, key: s3Key };
  }
}
