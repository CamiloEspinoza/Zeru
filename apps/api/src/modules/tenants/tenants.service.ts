import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateTenantSchema } from '@zeru/shared';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

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
