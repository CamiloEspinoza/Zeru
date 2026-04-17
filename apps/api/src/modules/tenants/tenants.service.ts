import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformStorageService } from '../platform-storage/platform-storage.service';
import { RolesService } from '../roles/roles.service';
import type { CreateTenantSchema, UpdateTenantSchema } from '@zeru/shared';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rolesService: RolesService,
    private readonly storage: PlatformStorageService,
  ) {}

  /** Create a new organization and add the requesting user as OWNER */
  async create(userId: string, data: CreateTenantSchema) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new ConflictException('Ya existe una organización con ese identificador (slug)');
    }

    const tenant = await this.prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          rut: data.rut,
          address: data.address,
          phone: data.phone,
        },
      });

      await tx.userTenant.create({
        data: {
          userId,
          tenantId: t.id,
          role: UserRole.OWNER,
        },
      });

      return t;
    });

    // Seed default system roles for the new tenant
    await this.rolesService.seedDefaultRoles(tenant.id);

    // Assign the owner role to the creating user
    const ownerRole = await this.prisma.role.findFirst({
      where: { tenantId: tenant.id, slug: 'owner' },
    });
    if (ownerRole) {
      await this.prisma.userTenant.updateMany({
        where: { userId, tenantId: tenant.id },
        data: { roleId: ownerRole.id },
      });
    }

    return tenant;
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { branding: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.branding) {
      const [logoUrl, isotipoUrl, faviconUrl] = await Promise.all([
        tenant.branding.logoUrl
          ? this.storage.getPresignedUrl(tenant.branding.logoUrl)
          : null,
        tenant.branding.isotipoUrl
          ? this.storage.getPresignedUrl(tenant.branding.isotipoUrl)
          : null,
        tenant.branding.faviconUrl
          ? this.storage.getPresignedUrl(tenant.branding.faviconUrl)
          : null,
      ]);
      return {
        ...tenant,
        branding: { ...tenant.branding, logoUrl, isotipoUrl, faviconUrl },
      };
    }

    return tenant;
  }

  findBySlug(slug: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { slug } });
  }

  update(id: string, data: UpdateTenantSchema) {
    return this.prisma.tenant.update({ where: { id }, data });
  }

  async getOnboardingStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { onboardingCompletedAt: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const [aiConfig, storageConfig] = await Promise.all([
      this.prisma.aiProviderConfig.findUnique({
        where: { tenantId },
        select: { id: true },
      }),
      this.prisma.storageConfig.findUnique({
        where: { tenantId },
        select: { id: true },
      }),
    ]);

    return {
      completed: !!tenant.onboardingCompletedAt,
      completedAt: tenant.onboardingCompletedAt,
      steps: {
        aiConfigured: !!aiConfig,
        storageConfigured: !!storageConfig,
      },
    };
  }

  async completeOnboarding(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { onboardingCompletedAt: new Date() },
    });
    return { completed: true };
  }
}
