import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LinkedInAuthService } from './linkedin-auth.service';

const LINKEDIN_API_BASE = 'https://api.linkedin.com';
const LINKEDIN_VERSION = '202504';

interface LinkedInHeaders extends Record<string, string> {
  Authorization: string;
  'LinkedIn-Version': string;
  'X-Restli-Protocol-Version': string;
  'Content-Type': string;
}

@Injectable()
export class LinkedInApiService {
  private readonly logger = new Logger(LinkedInApiService.name);

  constructor(private readonly authService: LinkedInAuthService) {}

  private async getHeaders(tenantId: string): Promise<LinkedInHeaders> {
    const token = await this.authService.getDecryptedToken(tenantId);
    return {
      Authorization: `Bearer ${token}`,
      'LinkedIn-Version': LINKEDIN_VERSION,
      'X-Restli-Protocol-Version': '2.0.0',
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(
    tenantId: string,
    path: string,
    options: { method: string; body?: unknown },
  ): Promise<T> {
    const headers = await this.getHeaders(tenantId);
    const response = await fetch(`${LINKEDIN_API_BASE}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`LinkedIn API error ${response.status}:`, errorText);
      throw new BadRequestException(`Error de LinkedIn API: ${response.status} - ${errorText}`);
    }

    if (response.status === 201) {
      const postId = response.headers.get('x-restli-id') ?? response.headers.get('X-RestLi-Id');
      return { postId } as T;
    }

    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  }

  async resolvePersonByVanityUrl(
    tenantId: string,
    vanityName: string,
  ): Promise<{ personUrn: string; firstName: string; lastName: string } | null> {
    try {
      const headers = await this.getHeaders(tenantId);
      const response = await fetch(
        `${LINKEDIN_API_BASE}/rest/people/(vanityName:${vanityName})`,
        { method: 'GET', headers },
      );

      if (!response.ok) {
        this.logger.warn(`Could not resolve vanity URL "${vanityName}": ${response.status}`);
        return null;
      }

      const data = (await response.json()) as { id?: string; firstName?: string; lastName?: string };
      if (!data.id) return null;

      return {
        personUrn: `urn:li:person:${data.id}`,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
      };
    } catch (error) {
      this.logger.warn(`Failed to resolve vanity URL "${vanityName}":`, error);
      return null;
    }
  }

  async createTextPost(
    tenantId: string,
    commentary: string,
    visibility: string = 'PUBLIC',
  ): Promise<{ postId: string | null }> {
    const connection = await this.authService.getConnection(tenantId);
    if (!connection) throw new BadRequestException('LinkedIn no conectado');

    const body = {
      author: connection.personUrn,
      commentary,
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    const result = await this.request<{ postId: string | null }>(tenantId, '/rest/posts', {
      method: 'POST',
      body,
    });

    return result;
  }

  async createArticlePost(
    tenantId: string,
    commentary: string,
    articleUrl: string,
    title: string,
    description?: string,
    visibility: string = 'PUBLIC',
  ): Promise<{ postId: string | null }> {
    const connection = await this.authService.getConnection(tenantId);
    if (!connection) throw new BadRequestException('LinkedIn no conectado');

    const body = {
      author: connection.personUrn,
      commentary,
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        article: {
          source: articleUrl,
          title,
          ...(description ? { description } : {}),
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    return this.request<{ postId: string | null }>(tenantId, '/rest/posts', {
      method: 'POST',
      body,
    });
  }

  async createImagePost(
    tenantId: string,
    commentary: string,
    imageUrn: string,
    visibility: string = 'PUBLIC',
  ): Promise<{ postId: string | null }> {
    const connection = await this.authService.getConnection(tenantId);
    if (!connection) throw new BadRequestException('LinkedIn no conectado');

    const body = {
      author: connection.personUrn,
      commentary,
      visibility,
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      content: {
        media: {
          id: imageUrn,
        },
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };

    return this.request<{ postId: string | null }>(tenantId, '/rest/posts', {
      method: 'POST',
      body,
    });
  }

  async initializeImageUpload(tenantId: string): Promise<{ uploadUrl: string; imageUrn: string }> {
    const connection = await this.authService.getConnection(tenantId);
    if (!connection) throw new BadRequestException('LinkedIn no conectado');

    const body = {
      initializeUploadRequest: {
        owner: connection.personUrn,
      },
    };

    const response = await this.request<{
      value: { uploadUrl: string; image: string };
    }>(tenantId, '/rest/images?action=initializeUpload', { method: 'POST', body });

    return {
      uploadUrl: response.value.uploadUrl,
      imageUrn: response.value.image,
    };
  }

  async uploadImageToLinkedIn(
    tenantId: string,
    imageBuffer: Buffer,
    mimeType: string = 'image/png',
  ): Promise<string> {
    const { uploadUrl, imageUrn } = await this.initializeImageUpload(tenantId);

    const token = await this.authService.getDecryptedToken(tenantId);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: imageBuffer,
    });

    if (!uploadResponse.ok) {
      throw new BadRequestException('Error al subir imagen a LinkedIn');
    }

    return imageUrn;
  }
}
