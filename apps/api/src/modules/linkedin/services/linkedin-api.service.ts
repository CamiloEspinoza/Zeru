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

  /**
   * Resolves a LinkedIn vanity name to a person URN using the Voyager API.
   * Requires the user's li_at session cookie (separate from the OAuth token).
   * Throws a special NO_SESSION_COOKIE error if the cookie is not configured.
   */
  async resolvePersonUrn(
    tenantId: string,
    vanityName: string,
  ): Promise<{ urn: string; displayName: string; plainId: number }> {
    const liAt = await this.authService.getDecryptedSessionCookie(tenantId);
    if (!liAt) {
      const err = new BadRequestException('NO_SESSION_COOKIE');
      (err as unknown as Record<string, unknown>)['isNoSessionCookie'] = true;
      throw err;
    }

    const csrfToken = `ajax:${Date.now()}`;

    // Use the newer "dash" Voyager endpoint (the old /profileView endpoint returns 410)
    const response = await fetch(
      `https://www.linkedin.com/voyager/api/identity/dash/profiles?q=memberIdentity&memberIdentity=${encodeURIComponent(vanityName)}`,
      {
        headers: {
          Cookie: `li_at=${liAt}; JSESSIONID="${csrfToken}"`,
          'csrf-token': csrfToken,
          'x-restli-protocol-version': '2.0.0',
          'accept': 'application/vnd.linkedin.normalized+json+2.1',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'x-li-lang': 'es_ES',
        },
      },
    );

    if (!response.ok) {
      throw new BadRequestException(
        `Error al acceder al perfil "${vanityName}" en LinkedIn (${response.status}). ` +
        `La cookie de sesión puede haber expirado — vuelve a copiarla desde tu browser.`,
      );
    }

    const data = await response.json() as {
      included?: Array<{
        $type?: string;
        firstName?: string;
        lastName?: string;
        objectUrn?: string;
        publicIdentifier?: string;
      }>;
    };

    const profile = data.included?.find(
      (item) => item.publicIdentifier === vanityName,
    ) ?? data.included?.find((item) => item.objectUrn?.includes(':member:'));

    const plainId = this.extractPlainIdFromUrn(profile?.objectUrn ?? '');
    if (!plainId) {
      throw new BadRequestException(
        `No se pudo extraer el ID del perfil "${vanityName}"`,
      );
    }

    const displayName =
      [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || vanityName;

    return { urn: `urn:li:person:${plainId}`, displayName, plainId };
  }

  /**
   * Resolves a LinkedIn company vanity name (from URL /company/{vanityName}) to an organization URN
   * using the official Organizations API.
   */
  async resolveOrganizationUrn(
    tenantId: string,
    vanityName: string,
  ): Promise<{ urn: string; displayName: string; orgId: number }> {
    const response = await this.request<{
      elements?: Array<{ id: number; localizedName?: string; name?: { localized?: { es_ES?: string; en_US?: string } } }>;
    }>(tenantId, `/rest/organizations?q=vanityName&vanityName=${encodeURIComponent(vanityName)}`, {
      method: 'GET',
    });

    const org = response.elements?.[0];
    if (!org) {
      throw new BadRequestException(`No se encontró la empresa "${vanityName}" en LinkedIn`);
    }

    const displayName =
      org.localizedName ??
      org.name?.localized?.es_ES ??
      org.name?.localized?.en_US ??
      vanityName;

    return {
      urn: `urn:li:organization:${org.id}`,
      displayName,
      orgId: org.id,
    };
  }

  private extractPlainIdFromUrn(urn: string): number | null {
    const match = urn.match(/:member:(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  }
}
