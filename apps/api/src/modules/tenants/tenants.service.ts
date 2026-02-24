import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpdateTenantSchema } from '@zeru/shared';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { id } });
  }

  findBySlug(slug: string) {
    return this.prisma.tenant.findUniqueOrThrow({ where: { slug } });
  }

  update(id: string, data: UpdateTenantSchema) {
    return this.prisma.tenant.update({ where: { id }, data });
  }
}
