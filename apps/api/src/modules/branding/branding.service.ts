import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStorageService } from '../platform-storage/platform-storage.service';
import { UpdateBrandingDto, GeneratePaletteDto } from './dto';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';

@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: PlatformStorageService,
  ) {}

  async getBranding(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding) return null;

    return {
      ...branding,
      logoUrl: branding.logoUrl
        ? await this.storage.getPresignedUrl(branding.logoUrl)
        : null,
      isotipoUrl: branding.isotipoUrl
        ? await this.storage.getPresignedUrl(branding.isotipoUrl)
        : null,
    };
  }

  async updateColors(tenantId: string, dto: UpdateBrandingDto) {
    return this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, ...dto },
      update: dto,
    });
  }

  async uploadImage(
    tenantId: string,
    type: 'logo' | 'isotipo',
    file: Express.Multer.File,
  ) {
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no soportado. Usa PNG, JPG o SVG.');
    }

    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 1 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Archivo muy grande. Maximo ${type === 'logo' ? '2MB' : '1MB'}.`,
      );
    }

    // Delete old image if exists
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const oldKey = type === 'logo' ? existing?.logoUrl : existing?.isotipoUrl;
    if (oldKey) {
      await this.storage.delete(oldKey);
    }

    const filename = `${uuid()}${extname(file.originalname)}`;
    const key = PlatformStorageService.buildBrandingKey(tenantId, type, filename);
    await this.storage.upload(key, file.buffer, file.mimetype);

    const updateField = type === 'logo' ? 'logoUrl' : 'isotipoUrl';
    const branding = await this.prisma.tenantBranding.upsert({
      where: { tenantId },
      create: { tenantId, [updateField]: key },
      update: { [updateField]: key },
    });

    return {
      ...branding,
      [updateField]: await this.storage.getPresignedUrl(key),
    };
  }

  async deleteImage(tenantId: string, type: 'logo' | 'isotipo') {
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!existing) return;

    const key = type === 'logo' ? existing.logoUrl : existing.isotipoUrl;
    if (key) {
      await this.storage.delete(key);
    }

    const updateField = type === 'logo' ? 'logoUrl' : 'isotipoUrl';
    return this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { [updateField]: null },
    });
  }

  /**
   * Returns branding assets for use in emails, PDFs, etc.
   * Resolves presigned URLs for images.
   */
  async getBrandingAssets(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { branding: true },
    });
    if (!tenant) return null;

    const branding = tenant.branding;
    const hasColors =
      branding?.primaryColor && branding?.secondaryColor && branding?.accentColor;

    return {
      logoUrl: branding?.logoUrl
        ? await this.storage.getPresignedUrl(branding.logoUrl)
        : null,
      isotipoUrl: branding?.isotipoUrl
        ? await this.storage.getPresignedUrl(branding.isotipoUrl)
        : null,
      colors: hasColors
        ? {
            primary: branding!.primaryColor!,
            secondary: branding!.secondaryColor!,
            accent: branding!.accentColor!,
          }
        : null,
      fallbackInitial: tenant.name.charAt(0).toUpperCase(),
      tenantName: tenant.name,
    };
  }

  /**
   * Placeholder for AI palette generation — see Task 5.
   */
  async generatePalette(_tenantId: string, _dto: GeneratePaletteDto): Promise<never> {
    throw new Error('Not implemented - see Task 5');
  }
}
