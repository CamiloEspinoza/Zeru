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
      faviconUrl: branding.faviconUrl
        ? await this.storage.getPresignedUrl(branding.faviconUrl)
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
    type: 'logo' | 'isotipo' | 'favicon',
    file: Express.Multer.File,
  ) {
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException('Formato no soportado. Usa PNG, JPG o SVG.');
    }

    const maxSize = type === 'logo' ? 2 * 1024 * 1024 : 1 * 1024 * 1024; // favicon and isotipo share 1MB limit
    if (file.size > maxSize) {
      throw new BadRequestException(
        `Archivo muy grande. Maximo ${type === 'logo' ? '2MB' : '1MB'}.`,
      );
    }

    // Delete old image if exists
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    const fieldMap = { logo: 'logoUrl', isotipo: 'isotipoUrl', favicon: 'faviconUrl' } as const;
    const updateField = fieldMap[type];
    const oldKey = existing?.[updateField] ?? null;
    if (oldKey) {
      await this.storage.delete(oldKey);
    }

    const filename = `${uuid()}${extname(file.originalname)}`;
    const key = PlatformStorageService.buildBrandingKey(tenantId, type, filename);
    await this.storage.upload(key, file.buffer, file.mimetype);
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

  async deleteImage(tenantId: string, type: 'logo' | 'isotipo' | 'favicon') {
    const existing = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!existing) return;

    const fieldMap = { logo: 'logoUrl', isotipo: 'isotipoUrl', favicon: 'faviconUrl' } as const;
    const updateField = fieldMap[type];
    const key = existing[updateField];
    if (key) {
      await this.storage.delete(key);
    }
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
      faviconUrl: branding?.faviconUrl
        ? await this.storage.getPresignedUrl(branding.faviconUrl)
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

  async setFaviconFromIsotipo(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding?.isotipoUrl) {
      throw new BadRequestException('Debes subir un isotipo primero');
    }

    // Just point favicon to the same key as isotipo
    return this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { faviconUrl: branding.isotipoUrl },
    });
  }

  async generateFavicon(tenantId: string) {
    const branding = await this.prisma.tenantBranding.findUnique({
      where: { tenantId },
    });
    if (!branding?.logoUrl && !branding?.isotipoUrl) {
      throw new BadRequestException('Debes subir un logo o isotipo primero');
    }

    const imageKey = branding.isotipoUrl || branding.logoUrl;
    const imageUrl = await this.storage.getPresignedUrl(imageKey!);

    // Download the image to send as base64
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');
    const mimeType = 'image/png';

    const { GoogleGenAI } = await import('@google/genai');
    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Image,
              },
            },
            {
              text: 'Generate a clean, simple favicon (32x32 pixels) based on this logo/icon. The favicon should be a simplified, recognizable version suitable for browser tabs. Use transparent background. Output only the favicon image, no text.',
            },
          ],
        },
      ],
      config: {
        responseModalities: ['image', 'text'],
      },
    });

    // Extract generated image from response
    const parts = response.candidates?.[0]?.content?.parts;
    const imagePart = parts?.find((p: any) => p.inlineData);

    if (!imagePart?.inlineData?.data) {
      throw new BadRequestException('No se pudo generar el favicon');
    }

    const faviconBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const filename = `${uuid()}.png`;
    const key = PlatformStorageService.buildBrandingKey(tenantId, 'favicon', filename);

    // Delete old favicon if exists and different from isotipo
    if (branding.faviconUrl && branding.faviconUrl !== branding.isotipoUrl) {
      await this.storage.delete(branding.faviconUrl);
    }

    await this.storage.upload(key, faviconBuffer, 'image/png');

    const updated = await this.prisma.tenantBranding.update({
      where: { tenantId },
      data: { faviconUrl: key },
    });

    // Log AI usage
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          tenantId,
          provider: 'GEMINI',
          model: 'gemini-2.0-flash-exp',
          feature: 'branding-favicon-generation',
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to log AI usage for favicon generation', error);
    }

    return {
      ...updated,
      faviconUrl: await this.storage.getPresignedUrl(key),
    };
  }

  async generatePalette(tenantId: string, dto: GeneratePaletteDto) {
    const OpenAI = (await import('openai')).default;
    const openai = new OpenAI();

    if (dto.source === 'logo') {
      const branding = await this.prisma.tenantBranding.findUnique({
        where: { tenantId },
      });
      if (!branding?.logoUrl && !branding?.isotipoUrl) {
        throw new BadRequestException('Debes subir un logo o isotipo primero');
      }

      const imageKey = branding.logoUrl || branding.isotipoUrl;
      const imageUrl = await this.storage.getPresignedUrl(imageKey!);

      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 256,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl },
              },
              {
                type: 'text',
                text: `Analiza este logotipo y sugiere una paleta de 3 colores para una aplicación web:
- primary: el color dominante/principal del logo, para botones y acciones principales
- secondary: un color complementario, para badges y elementos secundarios
- accent: un color de acento, para notificaciones y alertas

Requisitos:
- Los colores deben funcionar bien sobre fondo blanco (light mode) y fondo oscuro (dark mode)
- Ratio de contraste WCAG AA mínimo (4.5:1) para texto blanco sobre cada color
- Los 3 colores deben ser visualmente distintos entre sí

Responde SOLO con JSON válido, sin markdown: {"primary":"#hex","secondary":"#hex","accent":"#hex"}`,
              },
            ],
          },
        ],
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new BadRequestException('No se pudo generar la paleta');

      const palette = JSON.parse(content);
      await this.logAiUsage(tenantId, response);
      return palette;
    }

    // source === 'description'
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: `Genera una paleta de 3 colores para una aplicación web basándote en esta descripción: "${dto.description}"

- primary: color principal para botones y acciones
- secondary: color complementario para badges y elementos secundarios
- accent: color de acento para notificaciones y alertas

Requisitos:
- Los colores deben funcionar bien sobre fondo blanco y fondo oscuro
- Ratio de contraste WCAG AA mínimo (4.5:1) para texto blanco sobre cada color
- Los 3 colores deben ser visualmente distintos entre sí

Responde SOLO con JSON válido, sin markdown: {"primary":"#hex","secondary":"#hex","accent":"#hex"}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) throw new BadRequestException('No se pudo generar la paleta');

    const palette = JSON.parse(content);
    await this.logAiUsage(tenantId, response);
    return palette;
  }

  private async logAiUsage(tenantId: string, response: any) {
    try {
      await this.prisma.aiUsageLog.create({
        data: {
          tenantId,
          provider: 'OPENAI',
          model: response.model || 'gpt-4o',
          feature: 'branding-palette-generation',
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
      });
    } catch (error) {
      this.logger.warn('Failed to log AI usage', error);
    }
  }
}
