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
}
