import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LabPractitionerSearchSchema } from '@zeru/shared';

@Injectable()
export class LabPractitionerService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, filters: LabPractitionerSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (where.isActive !== undefined) whereClause.isActive = where.isActive;
    if (where.role) whereClause.roles = { has: where.role };
    if (where.query) {
      whereClause.OR = [
        { code: { contains: where.query, mode: 'insensitive' } },
        { firstName: { contains: where.query, mode: 'insensitive' } },
        { paternalLastName: { contains: where.query, mode: 'insensitive' } },
        { rut: { contains: where.query } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labPractitioner.findMany({
        where: whereClause,
        select: {
          id: true,
          rut: true,
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          roles: true,
          code: true,
          specialty: true,
          isActive: true,
          isInternal: true,
        },
        orderBy: { paternalLastName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labPractitioner.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const practitioner = await this.prisma.labPractitioner.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!practitioner) {
      throw new NotFoundException(`Practitioner ${id} not found`);
    }
    return practitioner;
  }
}
