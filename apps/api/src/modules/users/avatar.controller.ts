import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../files/s3.service';

@Controller('avatars')
@UseGuards(JwtAuthGuard, TenantGuard)
export class AvatarController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
  ) {}

  @Get(':userId')
  async getAvatar(
    @Param('userId') userId: string,
    @CurrentTenant() tenantId: string,
    @Res() res: Response,
  ) {
    // Find linked PersonProfile with avatar
    const person = await this.prisma.personProfile.findFirst({
      where: { userId, tenantId, deletedAt: null, avatarS3Key: { not: null } },
      select: { avatarS3Key: true },
    });

    if (!person?.avatarS3Key) {
      res.status(404).json({ message: 'No avatar' });
      return;
    }

    // Generate a presigned URL and redirect with cache headers
    const url = await this.s3.getPresignedUrl(tenantId, person.avatarS3Key, 86400);

    // Tell the browser to cache this redirect for 1 hour
    // The actual S3 URL is valid for 24h
    res.set('Cache-Control', 'private, max-age=3600, stale-while-revalidate=7200');
    res.redirect(302, url);
  }
}
