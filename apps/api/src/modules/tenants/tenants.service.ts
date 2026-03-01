import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { CreateTenantSchema, UpdateTenantSchema } from '@zeru/shared';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new organization and add the requesting user as OWNER */
  async create(userId: string, data: CreateTenantSchema) {
    const existing = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (existing) {
      throw new ConflictException('Ya existe una organización con ese identificador (slug)');
    }

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
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
          tenantId: tenant.id,
          role: UserRole.OWNER,
        },
      });

      return tenant;
    });
  }

  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
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
