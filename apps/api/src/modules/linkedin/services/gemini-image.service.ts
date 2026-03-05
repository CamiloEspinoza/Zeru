import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-preview-image-generation';

export interface GeneratedImage {
  s3Key: string;
  s3Url: string;
  buffer: Buffer;
  mimeType: string;
}

@Injectable()
export class GeminiImageService {
  private readonly logger = new Logger(GeminiImageService.name);
  private readonly ai: GoogleGenAI;
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('GOOGLE_GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });

    this.region = this.config.get('AWS_REGION', 'us-east-1');
    this.bucket = this.config.get('AWS_S3_BUCKET', 'zeru-dev');

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.config.get('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  async generateImage(
    tenantId: string,
    prompt: string,
    aspectRatio: string = '1:1',
  ): Promise<GeneratedImage> {
    this.logger.log(`Generating image for tenant ${tenantId}: "${prompt.slice(0, 60)}..."`);

    let response: Awaited<ReturnType<typeof this.ai.models.generateContent>>;
    try {
      response = await this.ai.models.generateContent({
        model: GEMINI_IMAGE_MODEL,
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

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
      }),
    );

    const getCmd = new GetObjectCommand({ Bucket: this.bucket, Key: s3Key });
    const s3Url = await getSignedUrl(this.s3Client, getCmd, { expiresIn: 60 * 60 * 24 * 7 });

    return { s3Key, s3Url, buffer, mimeType };
  }
}
