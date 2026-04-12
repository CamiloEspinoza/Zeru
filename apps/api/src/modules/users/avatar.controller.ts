import { Controller, Get, Param, Res } from '@nestjs/common';
import { Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageConfigService } from '../storage-config/storage-config.service';

// In-memory cache: userId → { buffer, contentType, fetchedAt }
const avatarCache = new Map<string, { buffer: Buffer; contentType: string; fetchedAt: number }>();
const CACHE_TTL_MS = 3600_000; // 1 hour

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageConfig: StorageConfigService,
  ) {}

  /**
   * Public endpoint — no auth required.
   * Avatar images are not sensitive and must be loadable via <img src="...">.
   */
  @Get(':userId')
  async getAvatar(
    @Param('userId') userId: string,
    @Res() res: Response,
  ) {
    // Check in-memory cache first
    const cached = avatarCache.get(userId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=3600, immutable');
      res.set('ETag', `"avatar-${userId}"`);
      res.send(cached.buffer);
      return;
    }

    // Find linked PersonProfile with avatar — resolve tenantId from the profile
    const person = await this.prisma.rawClient.personProfile.findFirst({
      where: { userId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true, tenantId: true },
    });

    if (!person?.avatarS3Key) {
      res.set('Cache-Control', 'public, max-age=300');
      res.status(404).json({ message: 'No avatar' });
      return;
    }

    try {
      const config = await this.storageConfig.getDecryptedConfig(person.tenantId);
      if (!config) {
        res.status(500).json({ message: 'Storage not configured' });
        return;
      }

      const client = new S3Client({
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });

      try {
        const s3Response = await client.send(
          new GetObjectCommand({ Bucket: config.bucket, Key: person.avatarS3Key }),
        );
        const contentType = s3Response.ContentType ?? 'image/jpeg';

        const stream = s3Response.Body as Readable;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);

        avatarCache.set(userId, { buffer, contentType, fetchedAt: Date.now() });

        res.set('Content-Type', contentType);
        res.set('Content-Length', String(buffer.length));
        res.set('Cache-Control', 'public, max-age=3600, immutable');
        res.set('ETag', `"avatar-${userId}"`);
        res.send(buffer);
      } finally {
        client.destroy();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ message: `Avatar fetch failed: ${msg}` });
    }
  }
}
