import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { GeminiConfigService } from '../../ai/services/gemini-config.service';
import { S3Service } from '../../files/s3.service';

const GEMINI_IMAGE_MODELS = {
  flash: 'gemini-3.1-flash-image-preview',
  pro: 'gemini-3-pro-image-preview',
} as const;

type ImageModel = keyof typeof GEMINI_IMAGE_MODELS;

export interface GeneratedImage {
  s3Key: string;
  s3Url: string;
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);
  private readonly fallbackApiKey: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly geminiConfigService: GeminiConfigService,
    private readonly s3Service: S3Service,
  ) {
    this.fallbackApiKey = this.config.get<string>('GOOGLE_GEMINI_API_KEY');
  }

  private async getApiKey(tenantId: string): Promise<string> {
    const tenantKey = await this.geminiConfigService.getDecryptedApiKey(tenantId);
    if (tenantKey) return tenantKey;
    if (this.fallbackApiKey) return this.fallbackApiKey;
    throw new BadRequestException(
      'No hay API key de Gemini configurada. Ve a Configuración > Gemini para agregar tu API key.',
    );
  }

  async generateImage(
    tenantId: string,
    prompt: string,
    aspectRatio: string = '1:1',
    model: ImageModel = 'flash',
  ): Promise<GeneratedImage> {
    const modelId = GEMINI_IMAGE_MODELS[model] ?? GEMINI_IMAGE_MODELS.flash;
    this.logger.log(`Generating image for tenant ${tenantId} [${modelId}]: "${prompt.slice(0, 60)}..."`);

    const apiKey = await this.getApiKey(tenantId);
    const ai = new GoogleGenAI({ apiKey });

    let response: Awaited<ReturnType<typeof ai.models.generateContent>>;
    try {
      response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE', 'TEXT'],
          imageConfig: { aspectRatio: aspectRatio as 'SQUARE' | '9:16' | '16:9' | '4:3' | '3:4' },
        },
      });
    } catch (err) {
      this.logger.error('Gemini image generation failed', err);
      throw new BadRequestException('Error al generar imagen con Gemini');
    }

    const candidates = response.candidates;
    if (!candidates?.length) {
      throw new BadRequestException('Gemini no devolvió candidatos');
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new BadRequestException('Gemini no devolvió partes de contenido');
    }

    let imageData: string | undefined;
    let mimeType = 'image/png';

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageData = part.inlineData.data;
        mimeType = part.inlineData.mimeType ?? 'image/png';
        break;
      }
    }

    if (!imageData) {
      throw new BadRequestException('Gemini no generó una imagen');
    }

    const buffer = Buffer.from(imageData, 'base64');
    const ext = mimeType.split('/')[1] ?? 'png';
    const imageId = randomUUID();
    const s3Key = `tenants/${tenantId}/linkedin-images/${imageId}.${ext}`;

    await this.s3Service.upload(tenantId, s3Key, buffer, mimeType);
    const s3Url = await this.s3Service.getPresignedUrl(tenantId, s3Key, 60 * 60 * 24 * 7);

    return { s3Key, s3Url, buffer, mimeType };
  }

  async uploadUserImage(
    tenantId: string,
    buffer: Buffer,
    mimeType: string,
    _originalName: string,
  ): Promise<{ s3Key: string; imageUrl: string }> {
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const imageId = randomUUID();
    const s3Key = `tenants/${tenantId}/linkedin-uploads/${imageId}.${ext}`;

    await this.s3Service.upload(tenantId, s3Key, buffer, mimeType);
    const imageUrl = await this.s3Service.getPresignedUrl(tenantId, s3Key, 60 * 60 * 24 * 7);

    return { s3Key, imageUrl };
  }
}
