import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageConfigService } from '../storage-config/storage-config.service';

// In-memory cache: "userId:size" → { buffer, fetchedAt }
const avatarCache = new Map<string, { buffer: Buffer; fetchedAt: number }>();
const CACHE_TTL_MS = 3600_000; // 1 hour

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageConfig: StorageConfigService,
  ) {}

  /**
   * Public endpoint — no auth required.
   * Serves resized avatar images. ?s=96 for 96x96 (default).
   */
  @Get(':userId')
  async getAvatar(
    @Param('userId') userId: string,
    @Query('s') sizeParam: string | undefined,
    @Res() res: Response,
  ) {
    const size = Math.min(Math.max(parseInt(sizeParam ?? '96', 10) || 96, 16), 512);
    const cacheKey = `${userId}:${size}`;

    // Check in-memory cache
    const cached = avatarCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.set('Content-Type', 'image/webp');
      res.set('Content-Length', String(cached.buffer.length));
      res.set('Cache-Control', 'public, max-age=3600, immutable');
      res.set('ETag', `"av-${userId}-${size}"`);
      res.send(cached.buffer);
      return;
    }

    // Find PersonProfile with avatar
    const person = await this.prisma.rawClient.personProfile.findFirst({
      where: { userId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true, tenantId: true },
    });

    if (!person?.avatarS3Key) {
      res.set('Cache-Control', 'public, max-age=300');
      res.status(404).send();
      return;
    }

    try {
      const config = await this.storageConfig.getDecryptedConfig(person.tenantId);
      if (!config) {
        res.status(500).send();
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

        const stream = s3Response.Body as Readable;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const rawBuffer = Buffer.concat(chunks);

        // Resize + convert to WebP for small file size
        const resized = await sharp(rawBuffer)
          .resize(size, size, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();

        avatarCache.set(cacheKey, { buffer: resized, fetchedAt: Date.now() });

        res.set('Content-Type', 'image/webp');
        res.set('Content-Length', String(resized.length));
        res.set('Cache-Control', 'public, max-age=3600, immutable');
        res.set('ETag', `"av-${userId}-${size}"`);
        res.send(resized);
      } finally {
        client.destroy();
      }
    } catch {
      res.status(500).send();
    }
  }
}
