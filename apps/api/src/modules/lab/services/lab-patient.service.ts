import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import type { LabPatientSearchSchema } from '@zeru/shared';

@Injectable()
export class LabPatientService {
  constructor(private readonly prisma: PrismaService) {}

  async search(tenantId: string, filters: LabPatientSearchSchema) {
    const { page, pageSize, ...where } = filters;
    const skip = (page - 1) * pageSize;

    const whereClause: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      mergedIntoId: null,
    };

    if (where.rut) {
      whereClause.rut = where.rut;
    } else if (where.query) {
      whereClause.OR = [
        { rut: { contains: where.query } },
        { firstName: { contains: where.query, mode: 'insensitive' } },
        { paternalLastName: { contains: where.query, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.labPatient.findMany({
        where: whereClause,
        select: {
          id: true,
          rut: true,
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          birthDate: true,
          gender: true,
          needsMerge: true,
          _count: { select: { serviceRequests: true } },
        },
        orderBy: { paternalLastName: 'asc' },
        skip,
        take: pageSize,
      }),
      this.prisma.labPatient.count({ where: whereClause }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(id: string, tenantId: string) {
    const patient = await this.prisma.labPatient.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        serviceRequests: {
          include: {
            diagnosticReports: {
              select: {
                id: true,
                fmInformeNumber: true,
                fmSource: true,
                status: true,
                conclusion: true,
                validatedAt: true,
              },
              orderBy: { validatedAt: 'desc' },
            },
          },
          orderBy: { requestedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!patient) throw new NotFoundException(`Patient ${id} not found`);
    return patient;
  }
}
