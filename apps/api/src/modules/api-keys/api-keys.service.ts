import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { ApiKeyScope } from '@zeru/shared';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }

  async generate(
    tenantId: string,
    userId: string,
    name: string,
    scopes: ApiKeyScope[],
  ) {
    const rawSecret = 'zk_' + randomBytes(48).toString('base64url');
    const keyPrefix = rawSecret.slice(0, 10) + '...';
    const keyHash = this.hashKey(rawSecret);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        name,
        keyPrefix,
        keyHash,
        scopes,
        tenantId,
        createdById: userId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        tenantId: true,
        createdById: true,
        lastUsedAt: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { apiKey, secret: rawSecret };
  }

  async validate(
    rawKey: string,
  ): Promise<{ id: string; tenantId: string; scopes: string[] } | null> {
    if (!rawKey.startsWith('zk_')) return null;
    const keyHash = this.hashKey(rawKey);
    const record = await this.prisma.apiKey.findUnique({
      where: { keyHash },
      select: { id: true, tenantId: true, scopes: true, isActive: true },
    });
    if (!record || !record.isActive) return null;
    return { id: record.id, tenantId: record.tenantId, scopes: record.scopes };
  }

  async touch(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async list(tenantId: string) {
    return this.prisma.apiKey.findMany({
      where: { tenantId, isActive: true },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(id: string, tenantId: string): Promise<void> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, tenantId },
    });
    if (!key) throw new NotFoundException('API key not found');
    if (!key.isActive) throw new ForbiddenException('API key already revoked');

    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
