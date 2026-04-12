import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageConfigService } from '../storage-config/storage-config.service';

// In-memory cache: userId → { buffer, contentType, fetchedAt }
const avatarCache = new Map<string, { buffer: Buffer; contentType: string; fetchedAt: number }>();
const CACHE_TTL_MS = 3600_000; // 1 hour

@Controller('avatars')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageConfig: StorageConfigService,
  ) {}

  @Get(':userId')
  async getAvatar(
    @Param('userId') userId: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    // Check in-memory cache first
    const cached = avatarCache.get(`${tenantId}:${userId}`);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=3600, immutable');
      res.set('ETag', `"avatar-${userId}"`);
      res.send(cached.buffer);
      return;
    }

    // Find linked PersonProfile with avatar
    const person = await this.prisma.personProfile.findFirst({
      where: { userId, tenantId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true },
    });

    if (!person?.avatarS3Key) {
      res.set('Cache-Control', 'public, max-age=300'); // cache 404 for 5 min
      res.status(404).json({ message: 'No avatar' });
      return;
    }

    try {
      // Get S3 config for tenant
      const config = await this.storageConfig.getDecryptedConfig(tenantId);
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
        const command = new GetObjectCommand({
          Bucket: config.bucket,
          Key: person.avatarS3Key,
        });

        const s3Response = await client.send(command);
        const contentType = s3Response.ContentType ?? 'image/jpeg';

        // Read the stream into a buffer for caching
        const stream = s3Response.Body as Readable;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.from(chunk));
        }
        const buffer = Buffer.concat(chunks);

        // Store in memory cache
        avatarCache.set(`${tenantId}:${userId}`, {
          buffer,
          contentType,
          fetchedAt: Date.now(),
        });

        // Send with aggressive cache headers
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
