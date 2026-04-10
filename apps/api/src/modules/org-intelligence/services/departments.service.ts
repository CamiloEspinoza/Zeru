import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  ListDepartmentsDto,
} from '../dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateDepartmentDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate parent exists if provided
    if (dto.parentId) {
      const parent = await client.department.findFirst({
        where: { id: dto.parentId, tenantId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException(
          `Departamento padre con id ${dto.parentId} no encontrado`,
        );
      }
    }

    try {
      return await client.department.create({
        data: {
          name: dto.name,
          description: dto.description,
          color: dto.color,
          parentId: dto.parentId ?? undefined,
          tenantId,
        },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { persons: { where: { deletedAt: null } } } },
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe un departamento con el nombre "${dto.name}"`,
        );
      }
      throw err;
    }
  }

  async findAll(tenantId: string, dto?: ListDepartmentsDto) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (dto?.search) {
      where.OR = [
        { name: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    return client.department.findMany({
      where,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { persons: { where: { deletedAt: null } } } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const department = await client.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, color: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { persons: { where: { deletedAt: null } } } },
      },
    });

    if (!department) {
      throw new NotFoundException(
        `Departamento con id ${id} no encontrado`,
      );
    }

    return department;
  }

  async update(tenantId: string, id: string, dto: UpdateDepartmentDto) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    // Validate parent exists if provided and is not self
    if (dto.parentId !== undefined && dto.parentId !== null) {
      if (dto.parentId === id) {
        throw new ConflictException(
          'Un departamento no puede ser su propio padre',
        );
      }
      const parent = await client.department.findFirst({
        where: { id: dto.parentId, tenantId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException(
          `Departamento padre con id ${dto.parentId} no encontrado`,
        );
      }
    }

    try {
      return await client.department.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.color !== undefined && { color: dto.color }),
          ...(dto.parentId !== undefined && { parentId: dto.parentId }),
        },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { persons: { where: { deletedAt: null } } } },
        },
      });
    } catch (err: unknown) {
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException(
          `Ya existe un departamento con el nombre "${dto.name}"`,
        );
      }
      throw err;
    }
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    return client.department.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findOrCreate(tenantId: string, name: string) {
    const client = this.prisma.forTenant(tenantId) as unknown as PrismaClient;

    const existing = await client.department.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        tenantId,
        deletedAt: null,
      },
    });

    if (existing) return existing;

    return client.department.create({
      data: {
        name,
        tenantId,
      },
    });
  }
}
