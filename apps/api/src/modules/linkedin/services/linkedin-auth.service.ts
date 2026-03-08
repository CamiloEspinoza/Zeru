import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../../../prisma/prisma.service';
import { EncryptionService } from '../../../common/services/encryption.service';

const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

export interface LinkedInConnectionInfo {
  id: string;
  personUrn: string;
  profileName: string | null;
  profileImage: string | null;
  expiresAt: Date;
  isExpired: boolean;
}

@Injectable()
export class LinkedInAuthService {
  private readonly logger = new Logger(LinkedInAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly encryption: EncryptionService,
  ) {}

  private get clientId() {
    return this.config.getOrThrow<string>('LINKEDIN_CLIENT_ID');
  }

  private get clientSecret() {
    return this.config.getOrThrow<string>('LINKEDIN_CLIENT_SECRET');
  }

  private get redirectUri() {
    const webPort = this.config.get('WEB_PORT', '3027');
    const nodeEnv = this.config.get('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      return 'https://www.zeruapp.com/oauth-linkedin-redirect';
    }
    return `http://localhost:${webPort}/oauth-linkedin-redirect`;
  }

  private signState(tenantId: string): string {
    const secret = this.config.get('JWT_SECRET', 'change-me');
    return createHmac('sha256', secret).update(tenantId).digest('hex').slice(0, 16) + ':' + tenantId;
  }

  private verifyState(state: string): string {
    const parts = state.split(':');
    if (parts.length < 2) throw new BadRequestException('Estado OAuth inválido');
    const tenantId = parts.slice(1).join(':');
    const expected = this.signState(tenantId).split(':')[0];
    if (parts[0] !== expected) throw new UnauthorizedException('Estado OAuth no válido');
    return tenantId;
  }

  getAuthUrl(tenantId: string): string {
    const state = this.signState(tenantId);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      scope: 'openid profile w_member_social',
    });
    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<LinkedInConnectionInfo> {
    const tenantId = this.verifyState(state);

    // Exchange code for tokens
    const tokenResponse = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      this.logger.error('LinkedIn token exchange failed', err);
      throw new BadRequestException('Error al obtener token de LinkedIn');
    }

    const tokenData = await tokenResponse.json() as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
      refresh_token_expires_in?: number;
    };

    // Fetch user profile via OpenID Connect userinfo
    const profileResponse = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!profileResponse.ok) {
      throw new BadRequestException('Error al obtener perfil de LinkedIn');
    }

    const profile = await profileResponse.json() as {
      sub: string;
      name?: string;
      picture?: string;
      email?: string;
    };

    const personUrn = `urn:li:person:${profile.sub}`;
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    const connection = await this.prisma.linkedInConnection.upsert({
      where: { tenantId },
      create: {
        tenantId,
        accessToken: this.encryption.encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? this.encryption.encrypt(tokenData.refresh_token) : null,
        expiresAt,
        personUrn,
        profileName: profile.name ?? null,
        profileImage: profile.picture ?? null,
      },
      update: {
        accessToken: this.encryption.encrypt(tokenData.access_token),
        refreshToken: tokenData.refresh_token ? this.encryption.encrypt(tokenData.refresh_token) : undefined,
        expiresAt,
        personUrn,
        profileName: profile.name ?? null,
        profileImage: profile.picture ?? null,
      },
    });

    return this.toConnectionInfo(connection);
  }

  async getConnection(tenantId: string): Promise<LinkedInConnectionInfo | null> {
    const connection = await this.prisma.linkedInConnection.findUnique({
      where: { tenantId },
    });
    if (!connection) return null;
    return this.toConnectionInfo(connection);
  }

  async disconnect(tenantId: string): Promise<void> {
    await this.prisma.linkedInConnection.deleteMany({ where: { tenantId } });
  }

  async saveSessionCookie(tenantId: string, liAtCookie: string): Promise<void> {
    const connection = await this.prisma.linkedInConnection.findUnique({ where: { tenantId } });
    if (!connection) throw new BadRequestException('LinkedIn no conectado. Conecta tu cuenta primero.');
    await this.prisma.linkedInConnection.update({
      where: { tenantId },
      data: { liAtCookie: this.encryption.encrypt(liAtCookie.trim()) },
    });
  }

  async getDecryptedSessionCookie(tenantId: string): Promise<string | null> {
    const connection = await this.prisma.linkedInConnection.findUnique({ where: { tenantId } });
    if (!connection?.liAtCookie) return null;
    return this.encryption.decrypt(connection.liAtCookie);
  }

  async hasSessionCookie(tenantId: string): Promise<boolean> {
    const connection = await this.prisma.linkedInConnection.findUnique({ where: { tenantId } });
    return !!connection?.liAtCookie;
  }

  async getDecryptedToken(tenantId: string): Promise<string> {
    const connection = await this.prisma.linkedInConnection.findUnique({
      where: { tenantId },
    });
    if (!connection) throw new BadRequestException('LinkedIn no conectado');

    // Try to refresh if expired or expiring soon (within 5 minutes)
    const expiresInMs = connection.expiresAt.getTime() - Date.now();
    if (expiresInMs < 5 * 60 * 1000) {
      if (connection.refreshToken) {
        try {
          return await this.refreshAccessToken(tenantId, connection);
        } catch {
          throw new BadRequestException('Token de LinkedIn expirado. Por favor reconecta tu cuenta.');
        }
      }
      throw new BadRequestException('Token de LinkedIn expirado. Por favor reconecta tu cuenta.');
    }

    return this.encryption.decrypt(connection.accessToken);
  }

  private async refreshAccessToken(tenantId: string, connection: { refreshToken: string | null; accessToken: string }): Promise<string> {
    if (!connection.refreshToken) throw new Error('No refresh token');

    const refreshToken = this.encryption.decrypt(connection.refreshToken);
    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }).toString(),
    });

    if (!response.ok) throw new Error('Refresh failed');

    const data = await response.json() as { access_token: string; expires_in: number; refresh_token?: string };

    await this.prisma.linkedInConnection.update({
      where: { tenantId },
      data: {
        accessToken: this.encryption.encrypt(data.access_token),
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        ...(data.refresh_token ? { refreshToken: this.encryption.encrypt(data.refresh_token) } : {}),
      },
    });

    return data.access_token;
  }

  private toConnectionInfo(connection: {
    id: string;
    personUrn: string;
    profileName: string | null;
    profileImage: string | null;
    expiresAt: Date;
  }): LinkedInConnectionInfo {
    return {
      id: connection.id,
      personUrn: connection.personUrn,
      profileName: connection.profileName,
      profileImage: connection.profileImage,
      expiresAt: connection.expiresAt,
      isExpired: connection.expiresAt < new Date(),
    };
  }
}
