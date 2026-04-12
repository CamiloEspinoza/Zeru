import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import sharp from 'sharp';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageConfigService } from '../storage-config/storage-config.service';

// In-memory cache: "key:size" → { buffer, fetchedAt }
const avatarCache = new Map<string, { buffer: Buffer; fetchedAt: number }>();
const CACHE_TTL_MS = 3600_000; // 1 hour

@Controller('avatars')
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageConfig: StorageConfigService,
  ) {}

  /** Avatar by userId — looks up linked PersonProfile */
  @Get(':userId')
  async getByUserId(
    @Param('userId') userId: string,
    @Query('s') sizeParam: string | undefined,
    @Res() res: Response,
  ) {
    const person = await this.prisma.rawClient.personProfile.findFirst({
      where: { userId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true, tenantId: true },
    });
    await this.serveAvatar(res, `user-${userId}`, person, sizeParam);
  }

  /** Avatar by personId — direct PersonProfile lookup */
  @Get('person/:personId')
  async getByPersonId(
    @Param('personId') personId: string,
    @Query('s') sizeParam: string | undefined,
    @Res() res: Response,
  ) {
    const person = await this.prisma.rawClient.personProfile.findFirst({
      where: { id: personId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true, tenantId: true },
    });
    await this.serveAvatar(res, `person-${personId}`, person, sizeParam);
  }

  /** Shared logic: fetch from S3, resize, cache, serve */
  private async serveAvatar(
    res: Response,
    cachePrefix: string,
    person: { avatarS3Key: string | null; tenantId: string } | null,
    sizeParam: string | undefined,
  ) {
    const size = Math.min(Math.max(parseInt(sizeParam ?? '96', 10) || 96, 16), 512);
    const cacheKey = `${cachePrefix}:${size}`;

    // Check in-memory cache
    const cached = avatarCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.set('Content-Type', 'image/webp');
      res.set('Content-Length', String(cached.buffer.length));
      res.set('Cache-Control', 'public, max-age=3600, immutable');
      res.set('ETag', `"${cachePrefix}-${size}"`);
      res.send(cached.buffer);
      return;
    }

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

        const resized = await sharp(rawBuffer)
          .resize(size, size, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();

        avatarCache.set(cacheKey, { buffer: resized, fetchedAt: Date.now() });

        res.set('Content-Type', 'image/webp');
        res.set('Content-Length', String(resized.length));
        res.set('Cache-Control', 'public, max-age=3600, immutable');
        res.set('ETag', `"${cachePrefix}-${size}"`);
        res.send(resized);
      } finally {
        client.destroy();
      }
    } catch {
      res.status(500).send();
    }
  }
}
